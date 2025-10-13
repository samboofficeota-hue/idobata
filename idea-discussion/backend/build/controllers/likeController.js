import mongoose from "mongoose";
import Like from "../models/Like.js";
// 質問にいいねを追加（重複チェックなし）
export const addLike = async (req, res) => {
    const { targetId, targetType } = req.body;
    const { questionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: "Invalid question ID format" });
    }
    try {
        // 質問にいいねを追加
        await Like.create({
            userId: `anonymous_${Date.now()}_${Math.random()}`, // 一時的な匿名ユーザーID
            targetId: questionId,
            targetType: "question",
        });
        const count = await Like.countDocuments({
            targetId: questionId,
            targetType: "question",
        });
        return res.status(201).json({
            success: true,
            count,
            message: "いいねが追加されました",
        });
    }
    catch (error) {
        console.error(`Error adding like for question ${questionId}:`, error);
        res.status(500).json({
            message: "いいねの追加中にエラーが発生しました",
            error: error.message,
        });
    }
};
// 質問のいいねを削除
export const removeLike = async (req, res) => {
    const { targetId, targetType } = req.body;
    const { questionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: "Invalid question ID format" });
    }
    try {
        // 最新のいいねを1つ削除（匿名ユーザーの場合）
        const likeToDelete = await Like.findOneAndDelete({
            targetId: questionId,
            targetType: "question",
        });
        if (!likeToDelete) {
            return res.status(404).json({
                success: false,
                message: "いいねが見つかりませんでした",
            });
        }
        const count = await Like.countDocuments({
            targetId: questionId,
            targetType: "question",
        });
        return res.status(200).json({
            success: true,
            count,
            message: "いいねが削除されました",
        });
    }
    catch (error) {
        console.error(`Error removing like for question ${questionId}:`, error);
        res.status(500).json({
            message: "いいねの削除中にエラーが発生しました",
            error: error.message,
        });
    }
};
// TODO: 認証基盤が入ったら認証対応
export const toggleLike = async (req, res) => {
    const { userId } = req.body;
    const { targetId, targetType } = req.params;
    if (!userId) {
        return res.status(400).json({ message: "userId is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: "Invalid target ID format" });
    }
    try {
        const existingLike = await Like.findOne({
            userId,
            targetId,
            targetType,
        });
        if (existingLike) {
            await Like.findByIdAndDelete(existingLike._id);
            const count = await Like.countDocuments({ targetId, targetType });
            return res.status(200).json({
                liked: false,
                count,
            });
        }
        await Like.create({
            userId,
            targetId,
            targetType,
        });
        const count = await Like.countDocuments({ targetId, targetType });
        return res.status(201).json({
            liked: true,
            count,
        });
    }
    catch (error) {
        console.error(`Error toggling like for ${targetType} ${targetId}:`, error);
        res.status(500).json({
            message: "Error toggling like status",
            error: error.message,
        });
    }
};
// TODO: 認証基盤が入ったら認証対応
export const getLikeStatus = async (req, res) => {
    const { userId } = req.query;
    const { targetId, targetType } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ message: "Invalid target ID format" });
    }
    try {
        const count = await Like.countDocuments({ targetId, targetType });
        let liked = false;
        if (userId) {
            const userLike = await Like.findOne({
                userId,
                targetId,
                targetType,
            });
            liked = !!userLike;
        }
        res.status(200).json({
            liked,
            count,
        });
    }
    catch (error) {
        console.error(`Error getting like status for ${targetType} ${targetId}:`, error);
        res.status(500).json({
            message: "Error getting like status",
            error: error.message,
        });
    }
};
//# sourceMappingURL=likeController.js.map