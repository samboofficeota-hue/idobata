import crypto from "node:crypto";
import express from "express";
import multer from "multer";
import { hitoriLimiter, transcribeLimiter } from "../middleware/rateLimit.js";
import { requireUser } from "../middleware/userTokenMiddleware.js";
import { isPromptKind, runHitoriAI } from "../services/hitori/ai.js";
import { createLockout } from "../services/kaigi/lockout.js";
import {
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
  detectAudioExtension,
  transcribeForSession,
} from "../services/kaigi/transcribe.js";

// ひとりいどばた。ボードと会話はブラウザに残し、サーバーには保存しない
//  - /verify     : 参加コード（HITORI_ACCESS_CODE）を確かめる
//  - /ai         : AIの役を1回呼ぶ。指示文はサーバーで作る
//  - /transcribe : 録音1回分を文字にする

const router = express.Router();

// 本番で未設定のときは閉じておく（誰でもAIを呼べてしまうため）
const DEFAULT_ACCESS_CODE = "dd";
const accessCodeMissing = () =>
  !process.env.HITORI_ACCESS_CODE && process.env.NODE_ENV === "production";

const codeLockout = createLockout();

const codeMatches = (input) => {
  const expected = Buffer.from(
    process.env.HITORI_ACCESS_CODE || DEFAULT_ACCESS_CODE
  );
  const actual = Buffer.from(typeof input === "string" ? input : "");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
};

const requireAccessCode = (req, res, next) => {
  if (accessCodeMissing()) {
    return res.status(503).json({
      message:
        "ひとりいどばたは準備中です（管理者が参加コードを設定していません）",
    });
  }
  const ip = req.ip;
  if (codeLockout.isLockedOut(ip)) {
    return res.status(429).json({
      message:
        "参加コードの入力に続けて失敗したため、しばらく時間をおいてから試してください",
    });
  }
  if (!codeMatches(req.get("x-hitori-code"))) {
    codeLockout.recordFailure(ip);
    return res.status(403).json({ message: "参加コードが違います" });
  }
  next();
};

router.post("/verify", requireAccessCode, (req, res) => {
  codeLockout.clear(req.ip);
  res.json({ ok: true });
});

router.post(
  "/ai",
  requireAccessCode,
  requireUser,
  hitoriLimiter,
  async (req, res) => {
    const { kind, args, state } = req.body ?? {};
    if (
      !isPromptKind(kind) ||
      !Array.isArray(args) ||
      !state ||
      typeof state !== "object"
    ) {
      return res
        .status(400)
        .json({ message: "送られた内容が正しくありません" });
    }
    try {
      return res.json({ result: await runHitoriAI(kind, args, state) });
    } catch (error) {
      if (error instanceof TypeError) {
        return res
          .status(400)
          .json({ message: "送られた内容が正しくありません" });
      }
      console.error(`[hitoriRoutes] ai failed kind=${kind}:`, error.message);
      return res.status(502).json({
        message: "AIにつながりませんでした。",
      });
    }
  }
);

// 録音は multer のメモリに置くだけで、文字にしたら捨てる
const parseAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
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

router.post(
  "/transcribe",
  requireAccessCode,
  requireUser,
  transcribeLimiter,
  audioUpload,
  async (req, res) => {
    const audio = req.file?.buffer;
    if (!audio || audio.length < MIN_AUDIO_BYTES) {
      return res.status(400).json({
        message: "声が聞き取れませんでした。もう少し長く話してください",
      });
    }
    const extension = detectAudioExtension(audio);
    if (!extension) {
      return res.status(400).json({
        message: "音声の形式に対応していません。もう一度録音してください",
      });
    }
    try {
      const title = String(req.body?.title ?? "").slice(0, 100);
      const text = await transcribeForSession(
        { title },
        null,
        audio,
        extension
      );
      return res.json({ text });
    } catch (error) {
      console.error("[hitoriRoutes] transcribe failed:", error.message);
      return res.status(502).json({
        message:
          "音声を文字にできませんでした。少し待ってから、もう一度試してください",
      });
    }
  }
);

export default router;
