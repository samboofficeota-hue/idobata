import express from "express";
import {
  deleteAllQuestionsByTheme,
  getDebateAnalysis,
  getQuestionDetails,
  getQuestionsByTheme,
  getReportExample,
  getVisualReport,
  triggerDebateAnalysisGeneration,
  triggerDigestGeneration,
  triggerPolicyGeneration,
  triggerReportGeneration,
  triggerVisualReportGeneration,
  updateQuestionVisibility,
} from "../controllers/questionController.js";
import { protect } from "../middleware/authMiddleware.js";

// 管理画面からだけ使う操作はログイン必須（protect）。生徒さんが使う閲覧・対話・「意見を送る」は公開のまま。
const router = express.Router({ mergeParams: true });

router.get("/", getQuestionsByTheme);
router.delete("/", protect, deleteAllQuestionsByTheme);

router.get("/:questionId/details", getQuestionDetails);

router.post("/:questionId/generate-policy", protect, triggerPolicyGeneration);

router.post("/:questionId/generate-digest", protect, triggerDigestGeneration);

router.post(
  "/:questionId/generate-visual-report",
  protect,
  triggerVisualReportGeneration
);
router.post("/:questionId/generate-report", protect, triggerReportGeneration);
router.post(
  "/:questionId/generate-debate-analysis",
  protect,
  triggerDebateAnalysisGeneration
);

router.get("/:questionId/visual-report", getVisualReport);
router.get("/:questionId/debate-analysis", getDebateAnalysis);
router.get("/:questionId/report", getReportExample);

router.put("/:questionId/visibility", protect, updateQuestionVisibility);

export default router;
