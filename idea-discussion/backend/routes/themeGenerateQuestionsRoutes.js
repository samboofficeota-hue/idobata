import express from "express";
import { triggerQuestionGenerationByTheme } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";

// 管理画面からだけ使う操作はログイン必須（protect）。生徒さんが使う閲覧・対話・「意見を送る」は公開のまま。
const router = express.Router({ mergeParams: true });

router.post("/", protect, triggerQuestionGenerationByTheme);

export default router;
