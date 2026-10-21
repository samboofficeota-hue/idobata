import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { llmLimiter, transcribeLimiter } from "../middleware/rateLimit.js";
import { requireUser } from "../middleware/userTokenMiddleware.js";
import KaigiRoom, { KAIGI_CAPACITIES } from "../models/KaigiRoom.js";
import KaigiSession from "../models/KaigiSession.js";
import KaigiSlide from "../models/KaigiSlide.js";
import {
  draftStory,
  makeSlide,
  reviseStory,
} from "../services/kaigi/editor.js";
import { hashHostKey } from "../services/kaigi/hostKey.js";
import { createLockout } from "../services/kaigi/lockout.js";
import { ensureOverview } from "../services/kaigi/overview.js";
import { openingMessage } from "../services/kaigi/prompts.js";
import {
  OUTPUT_LABELS,
  SESSION_MINUTES,
  STEPS,
  isChatStep,
  missingToLeave,
  nextStep,
  stepTiming,
} from "../services/kaigi/steps.js";
import {
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
  detectAudioExtension,
  transcribeForSession,
} from "../services/kaigi/transcribe.js";
import { runTurn } from "../services/kaigi/turn.js";
import { emitSlidePosted } from "../services/kaigi/wallEvents.js";
import kaigiHostRoutes from "./kaigiHostRoutes.js";

// いどばた会議室（設計ドキュメント v2）
//  - /host/*      : お題の作成。パスワード（KAIGI_HOST_PASSWORD）で保護（ログインと課金は未実装）
//  - /rooms/:roomId/host/* : お題ごとのホスト用の画面。作成時に返す鍵で保護（kaigiHostRoutes.js）
//  - /rooms/*     : お題の表示、参加、壁
//  - /sessions/*  : 参加者1人分の20分。いどばたの利用者ID（userId）が一致する本人だけが操作できる

const router = express.Router();

const DEFAULT_HOST_PASSWORD = "dd";
// 本番で未設定のときは、暫定パスワードでは通さない（誰でもお題を作れてしまうため）
const hostPasswordMissing = () =>
  !process.env.KAIGI_HOST_PASSWORD && process.env.NODE_ENV === "production";
if (!process.env.KAIGI_HOST_PASSWORD) {
  console.warn(
    hostPasswordMissing()
      ? "[kaigiRoutes] KAIGI_HOST_PASSWORD が未設定のため、お題の作成を止めています"
      : "[kaigiRoutes] KAIGI_HOST_PASSWORD が未設定のため、お題の作成に暫定パスワードを使っています"
  );
}

const retentionMs = () =>
  (Number(process.env.KAIGI_RETENTION_DAYS) || 30) * 24 * 60 * 60 * 1000;

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const text = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// ===== お題の作成（パスワード保護） =====

const passwordLockout = createLockout();

const passwordMatches = (input) => {
  const expected = Buffer.from(
    process.env.KAIGI_HOST_PASSWORD || DEFAULT_HOST_PASSWORD
  );
  const actual = Buffer.from(typeof input === "string" ? input : "");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
};

const requireHostPassword = (req, res, next) => {
  if (hostPasswordMissing()) {
    return res.status(503).json({
      message: "お題の作成は準備中です（管理者がパスワードを設定していません）",
    });
  }
  const ip = req.ip;
  if (passwordLockout.isLockedOut(ip)) {
    return res.status(429).json({
      message:
        "パスワードの入力に続けて失敗したため、しばらく時間をおいてから試してください",
    });
  }
  if (!passwordMatches(req.get("x-kaigi-password"))) {
    passwordLockout.recordFailure(ip);
    return res.status(401).json({ message: "パスワードが違います" });
  }
  passwordLockout.clear(ip);
  next();
};

const hostRouter = express.Router();
hostRouter.use(requireHostPassword);

hostRouter.post("/verify", (req, res) => res.json({ ok: true }));

hostRouter.post("/rooms", async (req, res) => {
  const b = req.body ?? {};
  const title = text(b.title, 200);
  if (!title) {
    return res.status(400).json({ message: "お題を入力してください" });
  }
  const capacity = Number(b.capacity);
  if (!KAIGI_CAPACITIES.includes(capacity)) {
    return res.status(400).json({ message: "参加人数の枠が正しくありません" });
  }

  // ホスト用の画面（Google 連携など）を開く鍵。保存するのはハッシュだけ
  const hostKey = crypto.randomBytes(32).toString("base64url");
  const room = await KaigiRoom.create({
    hostKeyHash: hashHostKey(hostKey),
    title,
    background: text(b.background, 4000),
    hostName: text(b.hostName, 50),
    capacity,
    expiresAt: new Date(Date.now() + retentionMs()),
  });

  // 工程3で最初の参加者に見せる候補を、お題と背景から先に作っておく
  ensureOverview(room).catch((error) =>
    console.error(
      `[kaigiRoutes] seed overview failed room=${room._id}:`,
      error.message
    )
  );

  return res.status(201).json({ id: room._id.toString(), hostKey });
});

router.use("/host", hostRouter);

// ホスト用の画面（お題ごとの鍵で保護）と Google 連携
router.use(kaigiHostRoutes);

// ===== 応答の形 =====

const toClientRoom = (room) => ({
  id: room._id.toString(),
  title: room.title,
  background: room.background,
  hostName: room.hostName,
  capacity: room.capacity,
  sessionMinutes: SESSION_MINUTES,
  expiresAt: room.expiresAt,
  // ホストが Google カレンダーに登録した会議（なければ null）
  meeting: room.meeting?.meetUrl
    ? {
        meetUrl: room.meeting.meetUrl,
        startAt: room.meeting.startAt,
        endAt: room.meeting.endAt,
      }
    : null,
});

const toClientOverview = (overview) =>
  overview?.updatedAt
    ? {
        issueCandidates: overview.issueCandidates,
        ideaCandidates: overview.ideaCandidates,
        conflicts: overview.conflicts,
        agreements: overview.agreements,
        voiceCount: overview.voiceCount,
        updatedAt: overview.updatedAt,
      }
    : null;

const toClientSession = (session, room, now = new Date()) => ({
  id: session._id.toString(),
  roomId: session.roomId.toString(),
  nickname: session.nickname,
  step: session.step,
  stepLabel: STEPS[session.step].label,
  status: session.status,
  messages: session.messages.map((m) => ({
    speaker: m.speaker,
    content: m.content,
    step: m.step,
    createdAt: m.createdAt,
  })),
  outputs: {
    domain: session.outputs.domain,
    issue: session.outputs.issue,
    solution: session.outputs.solution,
  },
  missingToLeave: missingToLeave(session.step, session.outputs),
  story: { draft: session.story.draft, final: session.story.final },
  slide: session.slide,
  overview: session.step >= 3 ? toClientOverview(room.overview) : null,
  timing: {
    serverNow: now,
    startedAt: session.startedAt,
    deadlineAt: session.deadlineAt,
    ...stepTiming(session, now),
  },
});

const toClientSlide = (s) => ({
  id: s._id.toString(),
  nickname: s.nickname,
  title: s.title,
  domain: s.domain,
  issue: s.issue,
  solution: s.solution,
  summary: s.summary,
  tags: s.tags,
  createdAt: s.createdAt,
});

const sendSession = (res, session, room, status = 200) =>
  res.status(status).json({
    session: toClientSession(session, room),
    room: toClientRoom(room),
  });

// ===== お題 =====

const loadRoom = async (req, res) => {
  if (!isId(req.params.roomId)) {
    res.status(400).json({ message: "お題のIDが正しくありません" });
    return null;
  }
  const room = await KaigiRoom.findById(req.params.roomId);
  if (!room) {
    res.status(404).json({
      message: "お題が見つかりません（期限が過ぎて削除された可能性があります）",
    });
    return null;
  }
  return room;
};

router.get("/rooms/:roomId", async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const [participantCount, submittedCount] = await Promise.all([
    KaigiSession.countDocuments({ roomId: room._id }),
    KaigiSlide.countDocuments({ roomId: room._id }),
  ]);
  return res.json({
    room: toClientRoom(room),
    participantCount,
    submittedCount,
  });
});

// 参加（同じ利用者が開き直したら、続きから再開する）
router.post("/rooms/:roomId/sessions", requireUser, async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const userId = req.verifiedUserId;
  const nickname = text(req.body?.nickname, 30);

  const existing = await KaigiSession.findOne({ roomId: room._id, userId });
  if (existing) return sendSession(res, existing, room);

  if (!nickname) {
    return res.status(400).json({ message: "ニックネームを入力してください" });
  }
  const count = await KaigiSession.countDocuments({ roomId: room._id });
  if (count >= room.capacity) {
    return res.status(409).json({
      message: `このお題の参加人数（${room.capacity}人）に達しています`,
    });
  }

  try {
    const session = await KaigiSession.create({
      roomId: room._id,
      userId,
      nickname,
      expiresAt: room.expiresAt,
    });
    return sendSession(res, session, room, 201);
  } catch (error) {
    // 同じ利用者が同時に2回押した場合
    if (error?.code === 11000) {
      const session = await KaigiSession.findOne({ roomId: room._id, userId });
      if (session) return sendSession(res, session, room);
    }
    throw error;
  }
});

router.get("/rooms/:roomId/my-session", requireUser, async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const session = await KaigiSession.findOne({
    roomId: room._id,
    userId: req.verifiedUserId,
  });
  if (!session) return res.json({ session: null, room: toClientRoom(room) });
  return sendSession(res, session, room);
});

// 壁：提出された提案スライド
router.get("/rooms/:roomId/wall", async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const slides = await KaigiSlide.find({ roomId: room._id })
    .sort({ createdAt: 1 })
    .lean();
  return res.json({
    room: toClientRoom(room),
    slides: slides.map(toClientSlide),
  });
});

// ===== 参加者1人分の20分 =====

// 同じセッションへの操作が重なると会話の保存がぶつかるので、1つずつ処理する
const busy = new Set();

// lock: false の操作（音声を文字にするだけで、セッションを書き換えない）は、
// AIの返答を待っている間でも受け付ける
const withSession =
  (handler, opts = {}) =>
  async (req, res) => {
    const { sessionId } = req.params;
    if (!isId(sessionId)) {
      return res
        .status(400)
        .json({ message: "セッションのIDが正しくありません" });
    }
    // 本文の userId ではなく、利用者トークンで確かめた userId で本人かを判定する
    const userId = req.verifiedUserId;
    if (!userId) return requireUser(req, res, () => {});
    const session = await KaigiSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "セッションが見つかりません" });
    }
    if (session.userId !== userId) {
      return res
        .status(403)
        .json({ message: "このセッションを操作する権限がありません" });
    }
    const room = await KaigiRoom.findById(session.roomId);
    if (!room) {
      return res.status(404).json({ message: "お題が見つかりません" });
    }

    if (req.method === "GET" || opts.lock === false) {
      return handler(req, res, { session, room });
    }

    if (busy.has(sessionId)) {
      return res.status(409).json({
        message:
          "前の操作を処理しています。少し待ってからもう一度試してください",
      });
    }
    busy.add(sessionId);
    try {
      return await handler(req, res, { session, room });
    } catch (error) {
      console.error(
        `[kaigiRoutes] ${req.method} ${req.path} failed:`,
        error.message
      );
      return res.status(502).json({
        message:
          "AIの応答に失敗しました。少し待ってから、もう一度試してください",
      });
    } finally {
      busy.delete(sessionId);
    }
  };

const requireActive = (session, res) => {
  if (session.status !== "active") {
    res.status(409).json({ message: "この提案はすでに提出されています" });
    return false;
  }
  return true;
};

const wrongStep = (res, session) =>
  res.status(409).json({
    message: `今の工程（${session.step}「${STEPS[session.step].label}」）ではできない操作です`,
  });

router.get(
  "/sessions/:sessionId",
  withSession((req, res, { session, room }) => sendSession(res, session, room))
);

// 工程3の整理を用意する（まだないか、新しい声が増えていれば作り直す）
router.post(
  "/sessions/:sessionId/overview",
  llmLimiter,
  withSession(async (req, res, { session, room }) => {
    if (session.step < 3) return wrongStep(res, session);
    await ensureOverview(room);
    return sendSession(res, session, room);
  })
);

// 工程1 → 2：20分の打ち込みを始める
router.post(
  "/sessions/:sessionId/start",
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (session.step !== 1) return sendSession(res, session, room);
    const now = new Date();
    session.step = 2;
    session.startedAt = now;
    session.stepStartedAt = now;
    session.deadlineAt = new Date(now.getTime() + SESSION_MINUTES * 60 * 1000);
    session.outputs.domain = session.outputs.domain || room.title;
    session.messages.push({
      speaker: "facilitator",
      content: openingMessage(room, session.nickname),
      step: 2,
      createdAt: now,
    });
    await session.save();
    return sendSession(res, session, room);
  })
);

// 参加者の発言 → AIの発言（1回）
router.post(
  "/sessions/:sessionId/messages",
  llmLimiter,
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (!isChatStep(session.step)) return wrongStep(res, session);
    const content = text(req.body?.content, 2000);
    if (!content) {
      return res.status(400).json({ message: "発言を入力してください" });
    }

    const now = new Date();
    session.messages.push({
      speaker: "user",
      content,
      step: session.step,
      createdAt: now,
    });
    await runTurn(room, session, { event: "reply", now });
    await session.save();

    // AIの判断で工程3に入ったら、みんなの声の整理を用意する
    if (session.step === 3) {
      await ensureOverview(room).catch((error) =>
        console.error(
          `[kaigiRoutes] overview failed room=${room._id}:`,
          error.message
        )
      );
    }
    return sendSession(res, session, room);
  })
);

// 音声入力：録音1回分を文字にして返す（発言としては保存しない。送るのは本人）
// 音声はメモリの上だけで扱い、ディスクにもデータベースにも残さない
const parseAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1, fields: 5 },
}).single("audio");

const audioUpload = (req, res, next) =>
  parseAudio(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? "録音が長すぎます。1回60秒までにしてください"
        : "音声を受け取れませんでした。もう一度録音してください",
    });
  });

const AUDIO_TYPE_ERROR =
  "音声の形式に対応していません。もう一度録音してください";

router.post(
  "/sessions/:sessionId/transcribe",
  transcribeLimiter,
  audioUpload,
  withSession(
    async (req, res, { session, room }) => {
      if (!requireActive(session, res)) return;
      if (!isChatStep(session.step)) return wrongStep(res, session);
      const audio = req.file?.buffer;
      if (!audio || audio.length < MIN_AUDIO_BYTES) {
        return res.status(400).json({
          message: "声が聞き取れませんでした。もう少し長く話してください",
        });
      }
      // ブラウザが申告する形式は偽れるので、中身の先頭で判定する
      const extension = detectAudioExtension(audio);
      if (!extension) {
        return res.status(400).json({ message: AUDIO_TYPE_ERROR });
      }
      try {
        const text = await transcribeForSession(
          room,
          session,
          audio,
          extension
        );
        return res.json({ text });
      } catch (error) {
        console.error(
          `[kaigiRoutes] transcribe failed session=${session._id}:`,
          error.message
        );
        return res.status(502).json({
          message:
            "音声を文字にできませんでした。少し待ってから、もう一度試してください",
        });
      }
    },
    { lock: false }
  )
);

// 参加者のボタン操作で次の工程へ進む
router.post(
  "/sessions/:sessionId/advance",
  llmLimiter,
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    const step = session.step;
    if (step === 1 || step >= 9) return wrongStep(res, session);

    const missing = missingToLeave(step, session.outputs);
    if (missing.length > 0) {
      return res.status(400).json({
        message: `次へ進む前に「${missing.map((k) => OUTPUT_LABELS[k]).join("・")}」を決めてください`,
      });
    }

    const now = new Date();
    if (step === 8) {
      // 3点がそろったので、編集者がストーリーにする
      session.story.draft = await draftStory(room, session);
    }
    session.step = nextStep(step);
    session.stepStartedAt = now;

    if (isChatStep(session.step)) {
      await runTurn(room, session, { event: "enter", now });
    }
    await session.save();

    if (session.step === 3) {
      await ensureOverview(room).catch((error) =>
        console.error(
          `[kaigiRoutes] overview failed room=${room._id}:`,
          error.message
        )
      );
    }
    return sendSession(res, session, room);
  })
);

// 参加者が3点を自分で書き直す
router.put(
  "/sessions/:sessionId/outputs",
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (session.step < 4 || session.step > 9) return wrongStep(res, session);
    for (const key of Object.keys(OUTPUT_LABELS)) {
      if (typeof req.body?.[key] === "string") {
        session.outputs[key] = text(req.body[key], 300);
      }
    }
    await session.save();
    return sendSession(res, session, room);
  })
);

// 工程9：ストーリーへのコメント → 編集者が書き直す
router.post(
  "/sessions/:sessionId/story/revise",
  llmLimiter,
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (session.step !== 9) return wrongStep(res, session);
    const comment = text(req.body?.comment, 1000);
    if (!comment) {
      return res.status(400).json({ message: "コメントを入力してください" });
    }
    const revised = await reviseStory(room, session, comment);
    if (revised) session.story.draft = revised;
    await session.save();
    return sendSession(res, session, room);
  })
);

// 工程9 → 10：ストーリーを確定し、1枚のスライドにまとめる
router.post(
  "/sessions/:sessionId/story/confirm",
  llmLimiter,
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (session.step !== 9) return wrongStep(res, session);
    const story = text(req.body?.story, 2000) || session.story.draft;
    if (!story) {
      return res.status(400).json({ message: "ストーリーが空です" });
    }
    session.story.final = story;
    session.slide = await makeSlide(room, session);
    session.step = 10;
    session.stepStartedAt = new Date();
    await session.save();
    return sendSession(res, session, room);
  })
);

// 工程10：スライドを提出して壁に貼る
router.post(
  "/sessions/:sessionId/submit",
  withSession(async (req, res, { session, room }) => {
    if (!requireActive(session, res)) return;
    if (session.step !== 10) return wrongStep(res, session);

    const edits = req.body?.slide ?? {};
    const limits = {
      title: 40,
      domain: 120,
      issue: 120,
      solution: 120,
      summary: 200,
    };
    for (const [key, max] of Object.entries(limits)) {
      if (typeof edits[key] === "string")
        session.slide[key] = text(edits[key], max);
    }

    const now = new Date();
    session.status = "submitted";
    session.submittedAt = now;
    await session.save();

    const slide = await KaigiSlide.findOneAndUpdate(
      { sessionId: session._id },
      {
        roomId: room._id,
        sessionId: session._id,
        nickname: session.nickname,
        title: session.slide.title,
        domain: session.slide.domain,
        issue: session.slide.issue,
        solution: session.slide.solution,
        summary: session.slide.summary,
        tags: session.slide.tags,
        expiresAt: room.expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    emitSlidePosted(room._id.toString(), toClientSlide(slide));
    return sendSession(res, session, room);
  })
);

export default router;
