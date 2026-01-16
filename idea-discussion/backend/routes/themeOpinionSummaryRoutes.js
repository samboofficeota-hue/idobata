import express from "express";
import { triggerOpinionSummaryGenerationByTheme } from "../controllers/adminController.js";

const router = express.Router({ mergeParams: true });

// POST /api/themes/:themeId/generate-opinion-summaries - 意見まとめを一括生成
router.post("/", triggerOpinionSummaryGenerationByTheme);

export default router;
