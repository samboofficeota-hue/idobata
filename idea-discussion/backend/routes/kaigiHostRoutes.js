import express from "express";
import mongoose from "mongoose";
import KaigiRoom from "../models/KaigiRoom.js";
import {
  KaigiGoogleError,
  accountStatus,
  cancelAuth,
  cancelMeeting,
  disconnect,
  finishAuth,
  googleConfigured,
  listRecords,
  scheduleMeeting,
  startAuth,
  syncRecords,
} from "../services/kaigi/google.js";
import { hostKeyMatches } from "../services/kaigi/hostKey.js";
import { createLockout } from "../services/kaigi/lockout.js";
import { ensureRoomAxes } from "../services/kaigi/roomAxes.js";

// いどばた会議室のホスト用の画面（お題ごと）
//  - /rooms/:roomId/host/*  : お題の作成時に返した鍵（x-kaigi-host-key）で保護
//  - /google/callback       : Google の連携画面から戻ってくる先（state で照合する）

const router = express.Router();
const keyLockout = createLockout();

const MIN_MEETING_MINUTES = 15;
const MAX_MEETING_MINUTES = 8 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const frontendUrl = () =>
  (process.env.KAIGI_FRONTEND_URL || "http://localhost:5173").replace(
    /\/+$/,
    ""
  );

const requireHostKey = async (req, res, next) => {
  const ip = req.ip;
  if (keyLockout.isLockedOut(ip)) {
    return res.status(429).json({
      message:
        "ホスト用の鍵の確認に続けて失敗したため、しばらく時間をおいてから試してください",
    });
  }
  const { roomId } = req.params;
  const room = mongoose.Types.ObjectId.isValid(roomId)
    ? await KaigiRoom.findById(roomId).select("+hostKeyHash")
    : null;
  // お題がないときも鍵が違うときも同じ応答にする（お題の有無を探られないように）
  if (!room || !hostKeyMatches(req.get("x-kaigi-host-key"), room.hostKeyHash)) {
    keyLockout.recordFailure(ip);
    return res
      .status(403)
      .json({ message: "このお題のホスト用の鍵が正しくありません" });
  }
  keyLockout.clear(ip);
  req.kaigiRoom = room;
  next();
};

const requireGoogle = (req, res, next) => {
  if (!googleConfigured()) {
    return res.status(503).json({
      message: "Google 連携は準備中です（サーバーの設定がありません）",
    });
  }
  next();
};

const sendError = (res, error) => {
  if (error instanceof KaigiGoogleError) {
    return res.status(error.status).json({ message: error.message });
  }
  throw error;
};

const toHostMeeting = (meeting) =>
  meeting?.meetUrl
    ? {
        meetUrl: meeting.meetUrl,
        meetingCode: meeting.meetingCode,
        calendarHtmlLink: meeting.calendarHtmlLink,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        recordsSyncedAt: meeting.recordsSyncedAt,
      }
    : null;

const toHostRecord = (record) => ({
  id: record._id.toString(),
  startTime: record.startTime,
  endTime: record.endTime,
  transcripts: record.transcripts.map((t) => ({
    state: t.state,
    docsUrl: t.docsUrl,
    entries: t.entries.map((e) => ({
      speaker: e.speaker,
      text: e.text,
      startTime: e.startTime,
    })),
  })),
  recordings: record.recordings.map((r) => ({ state: r.state, url: r.url })),
});

// お題に紐づいた、いどばたのテーマと、そこから作ったお題の軸カード
const toHostTheme = (room) => ({
  themeTitle: room.themeLink?.themeId ? room.themeLink.themeTitle : "",
  removedByHost: Boolean(room.themeLink?.removedByHost),
  checkedAt: room.themeLink?.checkedAt ?? null,
  axes: (room.axes?.items ?? []).map((a) => ({
    proposition: a.proposition,
    agreement: a.agreement ?? [],
    affirmative: a.affirmative,
    negative: a.negative,
    undecidedReason: a.undecidedReason,
  })),
});

const hostView = async (room) => ({
  room: {
    id: room._id.toString(),
    title: room.title,
    hostName: room.hostName,
    capacity: room.capacity,
    expiresAt: room.expiresAt,
  },
  google: {
    available: googleConfigured(),
    ...(await accountStatus(room._id)),
  },
  meeting: toHostMeeting(room.meeting),
  theme: toHostTheme(room),
});

const host = express.Router({ mergeParams: true });
host.use(requireHostKey);

host.get("/", async (req, res) => res.json(await hostView(req.kaigiRoom)));

// Google の連携画面のURLを返す。ブラウザはこのURLへ移動する
host.post("/google/connect", requireGoogle, async (req, res) => {
  const url = await startAuth(req.kaigiRoom._id);
  return res.json({ url });
});

host.delete("/google", requireGoogle, async (req, res) => {
  await disconnect(req.kaigiRoom._id);
  return res.json(await hostView(req.kaigiRoom));
});

// ① Google カレンダーに Meet 付きの予定を作る（あれば日時を変える）
host.put("/meeting", requireGoogle, async (req, res) => {
  const startAt = new Date(req.body?.startAt);
  const minutes = Number(req.body?.durationMinutes);
  const now = Date.now();
  if (
    Number.isNaN(startAt.getTime()) ||
    startAt.getTime() < now - DAY_MS ||
    startAt.getTime() > now + 365 * DAY_MS
  ) {
    return res.status(400).json({ message: "開始日時が正しくありません" });
  }
  if (
    !Number.isInteger(minutes) ||
    minutes < MIN_MEETING_MINUTES ||
    minutes > MAX_MEETING_MINUTES
  ) {
    return res.status(400).json({
      message: `会議の長さは${MIN_MEETING_MINUTES}分から${MAX_MEETING_MINUTES}分の間で指定してください`,
    });
  }
  const room = req.kaigiRoom;
  const roomUrl = `${frontendUrl()}/kaigi/${room._id}`;
  try {
    await scheduleMeeting(room, {
      startAt,
      endAt: new Date(startAt.getTime() + minutes * 60 * 1000),
      description: [
        room.background ? `${room.background}\n` : "",
        `自分の提案をつくる（20分）：${roomUrl}`,
        `会議室の壁：${roomUrl}/wall`,
      ].join("\n"),
    });
  } catch (error) {
    return sendError(res, error);
  }
  return res.json(await hostView(room));
});

host.delete("/meeting", requireGoogle, async (req, res) => {
  try {
    await cancelMeeting(req.kaigiRoom);
  } catch (error) {
    return sendError(res, error);
  }
  return res.json(await hostView(req.kaigiRoom));
});

// ② 文字起こしと録画（取り込み済みのもの）
host.get("/records", async (req, res) => {
  const records = await listRecords(req.kaigiRoom._id);
  return res.json({ records: records.map(toHostRecord) });
});

// 同じお題の取り込みが重なると、同じ記録を2回書き込むので1つずつ処理する
const syncing = new Set();

host.post("/records/sync", requireGoogle, async (req, res) => {
  const roomId = req.kaigiRoom._id.toString();
  if (syncing.has(roomId)) {
    return res
      .status(409)
      .json({ message: "取り込み中です。少し待ってから更新してください" });
  }
  syncing.add(roomId);
  try {
    const records = await syncRecords(req.kaigiRoom);
    return res.json({ records: records.map(toHostRecord) });
  } catch (error) {
    return sendError(res, error);
  } finally {
    syncing.delete(roomId);
  }
});

// いどばたのテーマを外す（自動では紐づけ直さない）。参加中の人は、始めた時点の論点のまま
host.delete("/theme", async (req, res) => {
  const room = req.kaigiRoom;
  room.themeLink = {
    themeId: null,
    themeTitle: "",
    removedByHost: true,
    checkedAt: room.themeLink?.checkedAt ?? null,
  };
  room.axes = {
    themeId: null,
    themeAxesVersion: null,
    items: [],
    builtAt: null,
  };
  await room.save();
  return res.json(await hostView(room));
});

// テーマをもう一度AIに探してもらう
host.post("/theme/relink", async (req, res) => {
  const room = req.kaigiRoom;
  room.themeLink = {
    themeId: null,
    themeTitle: "",
    removedByHost: false,
    checkedAt: null,
  };
  room.axes = {
    themeId: null,
    themeAxesVersion: null,
    items: [],
    builtAt: null,
  };
  await room.save();
  await ensureRoomAxes(room);
  return res.json(await hostView(room));
});

router.use("/rooms/:roomId/host", host);

// Google の連携画面から戻ってくる。結果を付けてホスト用の画面へ送り返す
// （送り返す先は KAIGI_FRONTEND_URL に固定。URL の値では決めない）
router.get("/google/callback", async (req, res) => {
  if (!googleConfigured()) {
    return res.redirect(303, `${frontendUrl()}/kaigi?google=unavailable`);
  }
  const back = (roomId, result) =>
    res.redirect(
      303,
      roomId
        ? `${frontendUrl()}/kaigi/${roomId}/host?google=${result}`
        : `${frontendUrl()}/kaigi?google=${result}`
    );
  if (req.query.error) {
    // 同意画面で「キャンセル」した場合など。state が正しいときだけお題へ戻す
    return back(await cancelAuth(req.query.state), "cancelled");
  }
  try {
    const { roomId } = await finishAuth({
      code: req.query.code,
      state: req.query.state,
    });
    return back(roomId, "connected");
  } catch (error) {
    console.error("[kaigiHostRoutes] google callback failed:", error.message);
    return back(error.roomId, "failed");
  }
});

export default router;
