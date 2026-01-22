import mongoose from "mongoose";
import DigestDraft from "../models/DigestDraft.js";
import SharpQuestion from "../models/SharpQuestion.js";

export const getDigestDraftsByTheme = async (req, res) => {
  const { themeId } = req.params;
  const { questionId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  try {
    let query = {};
    
    if (questionId) {
      // 特定のquestionIdでフィルタリング
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: "Invalid question ID format" });
      }
      // questionIdをObjectIdに変換（文字列の場合も対応）
      const questionObjectId = mongoose.Types.ObjectId.isValid(questionId)
        ? new mongoose.Types.ObjectId(questionId)
        : questionId;
      query.questionId = questionObjectId;
      
      console.log(`[getDigestDraftsByTheme] Searching for questionId: ${questionId} (converted to: ${questionObjectId})`);
    } else {
      // テーマ内のすべての問いを取得
      const questions = await SharpQuestion.find({ themeId });
      const questionIds = questions.map((q) => q._id);
      query.questionId = { $in: questionIds };
    }

    const drafts = await DigestDraft.find(query)
      .sort({ createdAt: -1 })
      .populate("questionId", "questionText")
      .populate("policyDraftId", "title")
      .lean();

    console.log(`[getDigestDraftsByTheme] Found ${drafts.length} digest drafts`);
    if (drafts.length > 0) {
      console.log(`[getDigestDraftsByTheme] First draft:`, {
        _id: drafts[0]._id,
        questionId: drafts[0].questionId,
        questionIdType: typeof drafts[0].questionId,
        title: drafts[0].title,
        hasContent: !!drafts[0].content,
        contentLength: drafts[0].content?.length || 0,
      });
    }

    res.status(200).json(drafts);
  } catch (error) {
    console.error(`Error fetching digest drafts for theme ${themeId}:`, error);
    res.status(500).json({
      message: "Failed to fetch digest drafts for theme",
      error: error.message,
    });
  }
};
