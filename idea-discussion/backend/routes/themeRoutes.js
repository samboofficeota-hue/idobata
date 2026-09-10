import express from "express";
import {
  createTheme,
  deleteTheme,
  getAllThemes,
  getAllThemesForAdmin,
  getThemeById,
  getThemeDetail,
  updateTheme,
} from "../controllers/themeController.js";
import { protect } from "../middleware/authMiddleware.js";

// 管理画面からだけ使う操作はログイン必須（protect）。生徒さんが使う閲覧・対話・「意見を送る」は公開のまま。
const router = express.Router();

router.get("/", getAllThemes);

// 管理画面用: 全てのテーマを取得（アクティブ・非アクティブ問わず）
router.get("/admin", protect, getAllThemesForAdmin);

router.get("/:themeId", getThemeById);

router.get("/:themeId/detail", getThemeDetail);

router.post("/", protect, createTheme);

router.put("/:themeId", protect, updateTheme);

router.delete("/:themeId", protect, deleteTheme);

export default router;
