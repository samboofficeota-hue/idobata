import express from "express";
import { getAllQuestions } from "../controllers/questionController.js";

const router = express.Router();

// GET /api/questions - 全ての質問を集計データ付きで取得（統一API）
router.get("/", getAllQuestions);

export default router;
