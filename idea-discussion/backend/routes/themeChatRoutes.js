import express from "express";
import {
  getThreadByUserAndQuestion,
  getThreadByUserAndTheme,
  getThreadExtractionsByTheme,
  getThreadMessagesByTheme,
  handleNewMessageByTheme,
  triggerExtractionForThread,
} from "../controllers/chatController.js";
import { llmLimiter } from "../middleware/rateLimit.js";
import { requireSelf, requireUser } from "../middleware/userTokenMiddleware.js";

const router = express.Router({ mergeParams: true });

// スレッドは本人（利用者トークンの userId）だけが読み書きできる
router.post("/messages", requireUser, llmLimiter, handleNewMessageByTheme);

router.get(
  "/threads/:threadId/extractions",
  requireUser,
  getThreadExtractionsByTheme
);

router.get(
  "/threads/:threadId/messages",
  requireUser,
  getThreadMessagesByTheme
);

router.post(
  "/threads/:threadId/extract",
  requireUser,
  llmLimiter,
  triggerExtractionForThread
);

const selfInQuery = requireSelf((req) => req.query.userId);

// 既存のエンドポイント: theme IDとuser IDでスレッドを取得 (theme-level chats)
router.get("/thread", selfInQuery, getThreadByUserAndTheme);

// 新しいエンドポイント: question IDとuser IDでスレッドを取得 (question-specific chats)
router.get("/thread-by-question", selfInQuery, getThreadByUserAndQuestion);

// 新しいチャット開始時の初期メッセージを取得
// TODO: getInitialChatMessage関数を実装する必要があります
// router.get("/initial-message", getInitialChatMessage);

export default router;
