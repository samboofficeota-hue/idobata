import mongoose, { Schema } from "mongoose";
const problemSchema = new Schema({
    themeId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Theme",
    },
    content: {
        type: String,
        required: true,
    },
    source: {
        type: String,
        required: true,
    },
    extractedFrom: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "ChatThread",
    },
}, { timestamps: true });
const Problem = mongoose.model("Problem", problemSchema);
export default Problem;
//# sourceMappingURL=Problem.js.map