import express from "express";
import {
  createUserSession,
  getUserInfo,
  updateUserDisplayName,
  uploadProfileImage,
} from "../controllers/userController.js";
import { uploadLimiter, userSessionLimiter } from "../middleware/rateLimit.js";
import { upload, verifyImage } from "../middleware/uploadMiddleware.js";
import { requireSelf } from "../middleware/userTokenMiddleware.js";

const router = express.Router();
const self = requireSelf((req) => req.params.userId);

// 利用者トークンを受け取る（/:userId より前に置く）
router.post("/session", userSessionLimiter, createUserSession);

router.get("/:userId", getUserInfo);

// 表示名と画像は本人だけが変えられる
router.put("/:userId", self, updateUserDisplayName);

router.post(
  "/:userId/profile-image",
  self,
  uploadLimiter,
  upload.single("profileImage"),
  verifyImage,
  uploadProfileImage
);

export default router;
