import mongoose from "mongoose";
const likeSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    targetType: {
        type: String,
        required: true,
        enum: ["question", "problem", "solution"], // Support for problems and solutions
    },
}, { timestamps: true });
likeSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
const Like = mongoose.model("Like", likeSchema);
export default Like;
//# sourceMappingURL=Like.js.map