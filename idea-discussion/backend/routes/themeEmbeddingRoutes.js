import express from "express";
import {
  clusterTheme,
  generateThemeEmbeddings,
  searchTheme,
} from "../controllers/embeddingController.js";
import { protect } from "../middleware/authMiddleware.js";

// 管理画面からだけ使う操作はログイン必須（protect）。生徒さんが使う閲覧・対話・「意見を送る」は公開のまま。
const router = express.Router({ mergeParams: true });

router.post("/embeddings/generate", protect, generateThemeEmbeddings);

router.get("/search", protect, searchTheme);

router.post("/cluster", protect, clusterTheme);

export default router;
