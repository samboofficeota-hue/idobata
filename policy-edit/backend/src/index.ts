// --- DEBUG: Print GitHub Env Vars ---
console.log("--- GitHub Environment Variables ---");
console.log("GITHUB_APP_ID:", process.env.GITHUB_APP_ID);
console.log("GITHUB_INSTALLATION_ID:", process.env.GITHUB_INSTALLATION_ID);
console.log("GITHUB_TARGET_OWNER:", process.env.GITHUB_TARGET_OWNER);
console.log("GITHUB_TARGET_REPO:", process.env.GITHUB_TARGET_REPO);
console.log("------------------------------------");
import cors from "cors";
// --- END DEBUG ---
import express from "express";
import { rateLimit } from "express-rate-limit";
import { CORS_ORIGIN, PORT } from "./config.js";
import chatRoutes from "./routes/chat.js";
import { logger } from "./utils/logger.js";

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Railway のプロキシ経由でも req.ip が利用者の IP になるようにする（回数制限で使う）
app.set("trust proxy", 1);

// チャットは AI を呼ぶので、IP ごとに回数を制限する（1分に20回・1日に300回）
const limitMessage = {
  error:
    "短い時間にたくさんの操作がありました。しばらく待ってから、もう一度試してください",
};
const chatLimiters = [
  rateLimit({ windowMs: 60 * 1000, limit: 20, message: limitMessage }),
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: 300,
    message: limitMessage,
  }),
];

// Routes
app.use("/chat", chatLimiters, chatRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`CORS enabled for origin: ${CORS_ORIGIN}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
