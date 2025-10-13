import express from "express";
import { createTheme, deleteTheme, getAllThemes, getAllThemesForAdmin, getThemeById, getThemeDetail, updateTheme, } from "../controllers/themeController.js";
const router = express.Router();
router.get("/", getAllThemes);
// 管理画面用: 全てのテーマを取得（アクティブ・非アクティブ問わず）
router.get("/admin", getAllThemesForAdmin);
router.get("/:themeId", getThemeById);
router.get("/:themeId/detail", getThemeDetail);
router.post("/", createTheme);
router.put("/:themeId", updateTheme);
router.delete("/:themeId", deleteTheme);
export default router;
//# sourceMappingURL=themeRoutes.js.map