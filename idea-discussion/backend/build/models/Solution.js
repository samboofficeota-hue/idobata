import mongoose, { Schema } from "mongoose";
const solutionSchema = new Schema({
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
const Solution = mongoose.model("Solution", solutionSchema);
export default Solution;
//# sourceMappingURL=Solution.js.map