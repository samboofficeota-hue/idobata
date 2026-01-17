import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cron from "node-cron";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { Server } from "socket.io";
import themeRoutes from "./routes/themeRoutes.js"; // Import theme routes
import { callLLM } from "./services/llmService.js"; // Import LLM service
import { runDailyBatch } from "./workers/dailyBatchProcessor.js"; // Import daily batch processor

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Database Connection ---
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error(
    "Error: MONGODB_URI is not defined in the environment variables."
  );
  console.error("Please set MONGODB_URI environment variable.");
  process.exit(1);
}

// Connect to MongoDB with async/await
async function connectToDatabase() {
  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    console.error("Failed to connect to MongoDB. Exiting...");
    process.exit(1);
  }
}

// --- Express App Setup ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.IDEA_CORS_ORIGIN
      ? process.env.IDEA_CORS_ORIGIN.split(",").map((url) => url.trim())
      : [
          "http://localhost:5173",
          "http://localhost:5175",
          "https://idobata-frontend-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-doisltwsmq-an.a.run.app",
          "https://idobata.sambo-office.com",
          "https://idobata-admin.sambo-office.com",
        ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
const PORT = process.env.PORT || 3000; // Use port from env or default to 3000

// --- Middleware ---
// CORS: Allow requests from configured origins
app.use(
  cors({
    origin: process.env.IDEA_CORS_ORIGIN
      ? process.env.IDEA_CORS_ORIGIN.split(",")
      : [
          "http://localhost:5173",
          "http://localhost:5175",
          "https://idobata-frontend-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-336788531163.asia-northeast1.run.app",
          "https://idobata-admin-doisltwsmq-an.a.run.app",
          "https://idobata.sambo-office.com",
          "https://idobata-admin.sambo-office.com",
        ],
    credentials: true,
  })
);

// JSON Parser: Parse incoming JSON requests
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// --- API Routes ---

import authRoutes from "./routes/authRoutes.js"; // 追加: 認証ルート
import likeRoutes from "./routes/likeRoutes.js"; // Import like routes
import opinionsRoutes from "./routes/opinionsRoutes.js"; // Import opinions routes
import questionEmbeddingRoutes from "./routes/questionEmbeddingRoutes.js";
import questionRoutes from "./routes/questionRoutes.js"; // Import unified question routes
import siteConfigRoutes from "./routes/siteConfigRoutes.js";
import themeChatRoutes from "./routes/themeChatRoutes.js";
import themeDigestRoutes from "./routes/themeDigestRoutes.js";
import themeEmbeddingRoutes from "./routes/themeEmbeddingRoutes.js";
import themeGenerateQuestionsRoutes from "./routes/themeGenerateQuestionsRoutes.js";
import themeImportRoutes from "./routes/themeImportRoutes.js";
import themeOpinionSummaryRoutes from "./routes/themeOpinionSummaryRoutes.js";
import themeDownloadOutputRoutes from "./routes/themeDownloadOutputRoutes.js";
import themePolicyRoutes from "./routes/themePolicyRoutes.js";
import themeProblemRoutes from "./routes/themeProblemRoutes.js";
// Import theme-based routes
import themeQuestionRoutes from "./routes/themeQuestionRoutes.js";
import themeSolutionRoutes from "./routes/themeSolutionRoutes.js";
import topPageRoutes from "./routes/topPageRoutes.js"; // Import top page routes
import userRoutes from "./routes/userRoutes.js"; // Import user routes

// Theme management routes
app.use("/api/themes", themeRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/themes/:themeId/questions", themeQuestionRoutes);
app.use("/api/themes/:themeId/problems", themeProblemRoutes);
app.use("/api/themes/:themeId/solutions", themeSolutionRoutes);
app.use(
  "/api/themes/:themeId/generate-questions",
  themeGenerateQuestionsRoutes
);
app.use(
  "/api/themes/:themeId/generate-opinion-summaries",
  themeOpinionSummaryRoutes
);
app.use("/api/themes/:themeId/download-output", themeDownloadOutputRoutes);
app.use("/api/themes/:themeId/policy-drafts", themePolicyRoutes);
app.use("/api/themes/:themeId/digest-drafts", themeDigestRoutes);
app.use("/api/themes/:themeId/import", themeImportRoutes);
app.use("/api/themes/:themeId/chat", themeChatRoutes);
// themeEmbeddingRoutes は最後に配置（より具体的なルートの後に）
app.use("/api/themes/:themeId", themeEmbeddingRoutes);

app.use("/api/site-config", siteConfigRoutes);
app.use("/api/opinions", opinionsRoutes); // Add opinions routes
app.use("/api/top-page-data", topPageRoutes); // Add top page routes
app.use("/api/questions", questionRoutes); // Add unified questions routes
app.use("/api/questions/:questionId", questionEmbeddingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/likes", likeRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- API-only backend ---
// This backend only serves API endpoints
// Frontend is hosted separately

// --- Error Handling Middleware (Example - Add more specific handlers later) ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// --- Socket.IO Setup ---
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("subscribe-theme", (themeId) => {
    console.log(`Socket ${socket.id} subscribing to theme: ${themeId}`);
    socket.join(`theme:${themeId}`);
  });

  socket.on("subscribe-thread", (threadId) => {
    console.log(`Socket ${socket.id} subscribing to thread: ${threadId}`);
    socket.join(`thread:${threadId}`);
  });

  socket.on("unsubscribe-theme", (themeId) => {
    console.log(`Socket ${socket.id} unsubscribing from theme: ${themeId}`);
    socket.leave(`theme:${themeId}`);
  });

  socket.on("unsubscribe-thread", (threadId) => {
    console.log(`Socket ${socket.id} unsubscribing from thread: ${threadId}`);
    socket.leave(`thread:${threadId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

export { io };

// --- Root Endpoint ---
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Idobata Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      themes: "/api/themes",
      questions: "/api/questions",
      health: "/api/health",
    },
  });
});

// --- Health Check Endpoint ---
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "idobata-backend",
  });
});

// --- Daily Batch Processing Scheduler ---
// 1日1回、深夜2時にバッチ処理を実行
// 処理対象: 管理画面でアクティブ設定（isActive: true）されているテーマのみ
// 非アクティブなテーマは自動的にスキップされる
const BATCH_SCHEDULE = process.env.BATCH_SCHEDULE || "0 2 * * *"; // デフォルト: 毎日2時

cron.schedule(BATCH_SCHEDULE, async () => {
  console.log(
    `[Scheduler] Daily batch processing triggered at ${new Date().toISOString()}`
  );
  try {
    await runDailyBatch();
  } catch (error) {
    console.error("[Scheduler] Error in scheduled daily batch processing:", error);
  }
});

console.log(
  `[Scheduler] Daily batch processing scheduled with cron: ${BATCH_SCHEDULE}`
);

// --- Start Server ---
async function startServer() {
  // Connect to database first
  await connectToDatabase();
  
  // Then start the HTTP server
  httpServer.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
  });
}

// Start the application
startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
