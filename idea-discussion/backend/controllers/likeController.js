import mongoose from "mongoose";
import Like from "../models/Like.js";

const countQuestionLikes = (questionId) =>
  Like.countDocuments({ targetId: questionId, targetType: "question" });

// 質問にいいねを追加（同じ利用者は1回まで）
export const addLike = async (req, res) => {
  const { questionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ message: "Invalid question ID format" });
  }

  try {
    await Like.updateOne(
      {
        userId: req.verifiedUserId,
        targetId: questionId,
        targetType: "question",
      },
      {},
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      count: await countQuestionLikes(questionId),
      message: "いいねが追加されました",
    });
  } catch (error) {
    console.error(`Error adding like for question ${questionId}:`, error);
    res.status(500).json({ message: "いいねの追加中にエラーが発生しました" });
  }
};

// 質問のいいねを削除（自分のいいねだけ）
export const removeLike = async (req, res) => {
  const { questionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ message: "Invalid question ID format" });
  }

  try {
    const likeToDelete = await Like.findOneAndDelete({
      userId: req.verifiedUserId,
      targetId: questionId,
      targetType: "question",
    });

    if (!likeToDelete) {
      return res.status(404).json({
        success: false,
        message: "いいねが見つかりませんでした",
      });
    }

    return res.status(200).json({
      success: true,
      count: await countQuestionLikes(questionId),
      message: "いいねが削除されました",
    });
  } catch (error) {
    console.error(`Error removing like for question ${questionId}:`, error);
    res.status(500).json({ message: "いいねの削除中にエラーが発生しました" });
  }
};

// TODO: 認証基盤が入ったら認証対応
export const toggleLike = async (req, res) => {
  // 本文の userId ではなく、利用者トークンで確かめた userId を使う
  const userId = req.verifiedUserId;
  const { targetId, targetType } = req.params;

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
  } catch (error) {
    console.error(`Error toggling like for ${targetType} ${targetId}:`, error);
    res.status(500).json({
      message: "Error toggling like status",
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
  } catch (error) {
    console.error(
      `Error getting like status for ${targetType} ${targetId}:`,
      error
    );
    res.status(500).json({
      message: "Error getting like status",
    });
  }
};
