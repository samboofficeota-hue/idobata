import mongoose, { Schema } from "mongoose";
const sharpQuestionSchema = new Schema({
    themeId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Theme",
    },
    content: {
        type: String,
        required: true,
    },
    tagLine: {
        type: String,
        required: false,
    },
    tags: {
        type: [String],
        default: [],
    },
    order: {
        type: Number,
        required: false,
    },
}, { timestamps: true });
const SharpQuestion = mongoose.model("SharpQuestion", sharpQuestionSchema);
export default SharpQuestion;
//# sourceMappingURL=SharpQuestion.js.map