import ChatThread from "../models/ChatThread.js";
import Like from "../models/Like.js";
import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import Theme from "../models/Theme.js";
import { getUser } from "./userController.js";

/**
 * Get latest themes and questions for the top page
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getTopPageData = async (req, res) => {
  try {
    const themes = await Theme.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(100);

    // アクティブなテーマのIDを取得
    const activeThemeIds = themes.map((theme) => theme._id);

    const questions = await SharpQuestion.find({
      themeId: { $in: activeThemeIds },
    })
      .sort({ createdAt: -1 })
      .limit(100); // Increased to get more questions

    // Get latest problems and solutions
    const latestProblems = await Problem.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .populate("themeId");

    const latestSolutions = await Solution.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .populate("themeId");

    // Combine and sort opinions by creation date
    const allOpinions = [
      ...latestProblems.map((p) => ({ ...p.toObject(), type: "problem" })),
      ...latestSolutions.map((s) => ({ ...s.toObject(), type: "solution" })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 15);

    // すべてのopinionIdを取得
    const opinionIds = allOpinions.map((o) => o._id);
    const problemIds = allOpinions
      .filter((o) => o.type === "problem")
      .map((o) => o._id);
    const solutionIds = allOpinions
      .filter((o) => o.type === "solution")
      .map((o) => o._id);

    // 一括でクエリを実行（N+1クエリ問題を解決）
    const [allQuestionLinks, allChatThreads, allLikes] = await Promise.all([
      QuestionLink.find({
        linkedItemId: { $in: opinionIds },
        linkedItemType: { $in: ["problem", "solution"] },
      }).populate("questionId"),
      ChatThread.find({
        $or: [
          { extractedProblemIds: { $in: problemIds } },
          { extractedSolutionIds: { $in: solutionIds } },
        ],
      }),
      Like.find({
        targetId: { $in: opinionIds },
        targetType: { $in: ["problem", "solution"] },
      }),
    ]);

    // メモリ上でマッピング
    const questionLinkMap = new Map();
    for (const link of allQuestionLinks) {
      const itemId = link.linkedItemId.toString();
      questionLinkMap.set(itemId, link);
    }

    const chatThreadMap = new Map();
    for (const thread of allChatThreads) {
      // Problem IDでマッピング
      if (thread.extractedProblemIds) {
        for (const pid of thread.extractedProblemIds) {
          const pidStr = pid.toString();
          if (!chatThreadMap.has(pidStr)) {
            chatThreadMap.set(pidStr, thread);
          }
        }
      }
      // Solution IDでマッピング
      if (thread.extractedSolutionIds) {
        for (const sid of thread.extractedSolutionIds) {
          const sidStr = sid.toString();
          if (!chatThreadMap.has(sidStr)) {
            chatThreadMap.set(sidStr, thread);
          }
        }
      }
    }

    const likeCountMap = new Map();
    for (const like of allLikes) {
      const targetId = like.targetId.toString();
      likeCountMap.set(targetId, (likeCountMap.get(targetId) || 0) + 1);
    }

    // ユーザー情報を一括取得（必要に応じて）
    const userIds = [
      ...new Set(
        Array.from(chatThreadMap.values())
          .map((t) => t.userId)
          .filter(Boolean)
      ),
    ];
    const userMap = new Map();
    if (userIds.length > 0) {
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            const user = await getUser(userId);
            if (user) {
              userMap.set(userId.toString(), user);
            }
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
          }
        })
      );
    }

    // メモリ上のデータを使用して結果を構築
    const opinionsWithQuestions = allOpinions.map((opinion) => {
      const opinionIdStr = opinion._id.toString();
      const questionLink = questionLinkMap.get(opinionIdStr);
      const chatThread = chatThreadMap.get(opinionIdStr);

      let authorName = "匿名ユーザー";
      if (chatThread?.userId) {
        const user = userMap.get(chatThread.userId.toString());
        if (user?.displayName) {
          authorName = user.displayName;
        }
      }

      return {
        id: opinion._id,
        type: opinion.type,
        text: opinion.statement,
        authorName,
        questionTitle:
          questionLink?.questionId?.questionText ||
          opinion.themeId?.title ||
          "質問",
        questionTagline: questionLink?.questionId?.tagLine || "",
        questionId: questionLink?.questionId?._id || "",
        createdAt: opinion.createdAt,
        likeCount: likeCountMap.get(opinionIdStr) || 0,
        commentCount: 0, // You can implement comment counting if needed
      };
    });

    const enhancedThemes = await Promise.all(
      themes.map(async (theme) => {
        const keyQuestionCount = await SharpQuestion.countDocuments({
          themeId: theme._id,
        });

        const commentCount = await ChatThread.countDocuments({
          themeId: theme._id,
        });

        return {
          _id: theme._id,
          title: theme.title,
          description: theme.description || "",
          slug: theme.slug,
          keyQuestionCount,
          commentCount,
        };
      })
    );

    const enhancedQuestions = await Promise.all(
      questions.map(async (question) => {
        const questionId = question._id;

        const issueCount = await QuestionLink.countDocuments({
          questionId,
          linkedItemType: "problem",
        });

        const solutionCount = await QuestionLink.countDocuments({
          questionId,
          linkedItemType: "solution",
        });

        const likeCount = await Like.countDocuments({
          targetId: questionId,
          targetType: "question",
        });

        // Get unique participant count from chat threads
        const uniqueParticipantCount = await ChatThread.distinct("userId", {
          themeId: question.themeId,
        }).then((userIds) => userIds.filter((userId) => userId).length);

        return {
          ...question.toObject(),
          issueCount,
          solutionCount,
          likeCount,
          uniqueParticipantCount,
        };
      })
    );

    return res.status(200).json({
      latestThemes: enhancedThemes,
      latestQuestions: enhancedQuestions,
      latestOpinions: opinionsWithQuestions,
    });
  } catch (error) {
    console.error("Error fetching top page data:", error);
    return res.status(500).json({
      message: "Error fetching top page data",
      error: error.message,
    });
  }
};

// GET /api/opinions - 意見データのみを取得
export const getOpinions = async (req, res) => {
  try {
    // アクティブなテーマのIDを取得
    const activeThemes = await Theme.find({ isActive: true });
    const activeThemeIds = activeThemes.map((theme) => theme._id);

    // アクティブなテーマに関連する質問のIDを取得
    const activeQuestions = await SharpQuestion.find({
      themeId: { $in: activeThemeIds },
    }).select("_id");

    const activeQuestionIds = activeQuestions.map((q) => q._id);

    // アクティブなテーマに関連する問題と解決策を取得
    const latestProblems = await Problem.find({
      questionId: { $in: activeQuestionIds },
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .populate("themeId");

    const latestSolutions = await Solution.find({
      questionId: { $in: activeQuestionIds },
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .populate("themeId");

    // 問題と解決策を統合して意見として処理
    const allOpinions = [
      ...latestProblems.map((problem) => ({
        _id: problem._id,
        type: "problem",
        statement: problem.statement,
        themeId: problem.themeId,
        questionId: problem.questionId,
        createdAt: problem.createdAt,
      })),
      ...latestSolutions.map((solution) => ({
        _id: solution._id,
        type: "solution",
        statement: solution.statement,
        themeId: solution.themeId,
        questionId: solution.questionId,
        createdAt: solution.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 意見データを拡張
    const latestOpinions = await Promise.all(
      allOpinions.map(async (opinion) => {
        const questionLink = await QuestionLink.findOne({
          questionId: opinion.questionId,
        }).populate("questionId");

        const authorName = await getUser(opinion._id);

        const likeCount = await Like.countDocuments({
          targetId: opinion._id,
          targetType: opinion.type,
        });

        return {
          id: opinion._id,
          type: opinion.type,
          text: opinion.statement,
          authorName,
          questionTitle:
            questionLink?.questionId?.questionText ||
            opinion.themeId?.title ||
            "質問",
          questionTagline: questionLink?.questionId?.tagLine || "",
          questionId: questionLink?.questionId?._id || "",
          createdAt: opinion.createdAt,
          likeCount,
          commentCount: 0,
        };
      })
    );

    return res.status(200).json(latestOpinions);
  } catch (error) {
    console.error("Error fetching opinions:", error);
    return res.status(500).json({
      message: "Error fetching opinions",
      error: error.message,
    });
  }
};
