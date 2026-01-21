import express from "express";
import {
  createAdminUser,
  deleteAdminUser,
  deleteAllAdminUsers,
  getCurrentUser,
  initializeAdminUser,
  login,
  resetAdminUser,
} from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.delete("/admin-users", deleteAdminUser);
router.delete("/admin-users/all", deleteAllAdminUsers); // すべての管理者ユーザーを削除
router.post("/initialize", initializeAdminUser);
router.post("/reset", resetAdminUser); // 強制的にリセット・作成

export default router;
