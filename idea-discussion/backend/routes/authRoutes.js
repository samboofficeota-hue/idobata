import express from "express";
import {
  createAdminUser,
  deleteAdminUser,
  getCurrentUser,
  initializeAdminUser,
  login,
  resetAdminUser,
} from "../controllers/authController.js";
import { admin, protect } from "../middleware/authMiddleware.js";
import { bootstrapLimiter, loginLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/login", loginLimiter, login);
router.get("/me", protect, getCurrentUser);
router.post("/users", protect, admin, createAdminUser);
router.delete("/admin-users", protect, admin, deleteAdminUser);
// 「すべての管理者を削除」は、/initialize と組み合わせると乗っ取りに使えるため廃止した
// 管理者が0人で、かつ ADMIN_BOOTSTRAP_TOKEN が合うときだけ最初の1人を作れる
router.post("/initialize", bootstrapLimiter, initializeAdminUser);
// 以前は誰でも任意のパスワードで管理者を作り直せた。ログインできなくなったときは
// scripts/resetAdminPassword.mjs を railway run で実行してパスワードを再設定する
router.post("/reset", protect, admin, resetAdminUser); // 強制的にリセット・作成

export default router;
