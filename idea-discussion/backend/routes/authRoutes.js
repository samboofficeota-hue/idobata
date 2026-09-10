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
router.delete("/admin-users", protect, admin, deleteAdminUser);
router.delete("/admin-users/all", protect, admin, deleteAllAdminUsers); // すべての管理者ユーザーを削除
// 管理者が0人のときだけ最初の1人を作れる（authController 側で件数を確認している）ので公開のまま
router.post("/initialize", initializeAdminUser);
// 以前は誰でも任意のパスワードで管理者を作り直せた。ログインできなくなったときは
// scripts/resetAdminPassword.mjs を railway run で実行してパスワードを再設定する
router.post("/reset", protect, admin, resetAdminUser); // 強制的にリセット・作成

export default router;
