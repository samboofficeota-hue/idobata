import express from "express";
import { addLike, removeLike } from "../controllers/likeController.js";
import { getAllQuestions } from "../controllers/questionController.js";

const router = express.Router();

// GET /api/questions - 全ての質問を集計データ付きで取得（統一API）
router.get("/", getAllQuestions);

// POST /api/questions/:questionId/like - 質問にいいねを追加
router.post("/:questionId/like", addLike);

// DELETE /api/questions/:questionId/like - 質問のいいねを削除
router.delete("/:questionId/like", removeLike);

export default router;
