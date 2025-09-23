import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
); // Don't create separate _id for subdocuments

const chatThreadSchema = new mongoose.Schema(
  {
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theme",
      required: true,
    },
    messages: [messageSchema],
    userId: {
      type: String,
      required: false,
      index: true, // Index userId for faster lookups
    },
    sessionId: {
      type: String,
      required: true,
    },
    extractedProblemIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem", // Reference to the Problem model
      },
    ],
    extractedSolutionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Solution", // Reference to the Solution model
      },
    ],
    questionId: {
      // 追加：特定の質問に関連するスレッドかどうか
      type: mongoose.Schema.Types.ObjectId,
      ref: "SharpQuestion",
      required: false,
      index: true, // Index questionId for faster lookups
    },
  },
  { timestamps: true }
); // Adds createdAt and updatedAt automatically

const ChatThread = mongoose.model("ChatThread", chatThreadSchema);

export default ChatThread;

