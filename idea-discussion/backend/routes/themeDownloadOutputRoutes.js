import express from "express";
import { generateThemeDownloadOutput } from "../controllers/adminController.js";

const router = express.Router({ mergeParams: true });

// GET /api/themes/:themeId/download-output - ダウンロード用アウトプットを取得
router.get("/", generateThemeDownloadOutput);

export default router;
