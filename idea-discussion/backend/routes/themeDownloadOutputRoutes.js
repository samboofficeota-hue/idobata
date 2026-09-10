import express from "express";
import { generateThemeDownloadOutput } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";

// 管理画面からだけ使う操作はログイン必須（protect）。生徒さんが使う閲覧・対話・「意見を送る」は公開のまま。
const router = express.Router({ mergeParams: true });

// GET /api/themes/:themeId/download-output - ダウンロード用アウトプットを取得
router.get("/", protect, generateThemeDownloadOutput);

export default router;
