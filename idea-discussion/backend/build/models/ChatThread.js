import mongoose, { Schema } from "mongoose";
const chatMessageSchema = new Schema({
    role: {
        type: String,
        enum: ["user", "assistant", "system"],
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
});
const chatThreadSchema = new Schema({
    themeId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Theme",
    },
    messages: [chatMessageSchema],
    userId: {
        type: String,
        required: false,
    },
    sessionId: {
        type: String,
        required: true,
    },
}, { timestamps: true });
const ChatThread = mongoose.model("ChatThread", chatThreadSchema);
export default ChatThread;
//# sourceMappingURL=ChatThread.js.map