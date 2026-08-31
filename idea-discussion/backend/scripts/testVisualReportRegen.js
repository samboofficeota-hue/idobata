import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../..", ".env") });

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("Error: MONGODB_URI is not defined.");
  process.exit(1);
}

const questionId = process.argv[2];
if (!questionId) {
  console.error("Usage: node testVisualReportRegen.js <questionId>");
  process.exit(1);
}

import { generateQuestionVisualReport } from "../services/questionVisualReportGenerator.js";

async function main() {
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.");

  const report = await generateQuestionVisualReport(questionId);
  console.log(`New version: ${report.version}`);
  console.log(`HTML length: ${report.overallAnalysis.length} chars`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Test generation failed:", err);
  process.exit(1);
});
