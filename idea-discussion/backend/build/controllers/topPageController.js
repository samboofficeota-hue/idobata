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
        // Get sharp question details for opinions
        const opinionsWithQuestions = await Promise.all(allOpinions.map(async (opinion) => {
            // Find which sharp question this opinion is linked to
            const questionLink = await QuestionLink.findOne({
                linkedItemId: opinion._id,
                linkedItemType: opinion.type,
            }).populate("questionId");
            // Get author info from chat thread
            const chatThread = await ChatThread.findOne({
                $or: [
                    { extractedProblemIds: opinion._id },
                    { extractedSolutionIds: opinion._id },
                ],
            });
            let authorName = "匿名ユーザー";
            if (chatThread?.userId) {
                const user = await getUser(chatThread.userId);
                if (user?.displayName) {
                    authorName = user.displayName;
                }
            }
            // Get like and comment counts
            const likeCount = await Like.countDocuments({
                targetId: opinion._id,
                targetType: opinion.type,
            });
            return {
                id: opinion._id,
                type: opinion.type,
                text: opinion.statement,
                authorName,
                questionTitle: questionLink?.questionId?.questionText ||
                    opinion.themeId?.title ||
                    "質問",
                questionTagline: questionLink?.questionId?.tagLine || "",
                questionId: questionLink?.questionId?._id || "",
                createdAt: opinion.createdAt,
                likeCount,
                commentCount: 0, // You can implement comment counting if needed
            };
        }));
        const enhancedThemes = await Promise.all(themes.map(async (theme) => {
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
        }));
        const enhancedQuestions = await Promise.all(questions.map(async (question) => {
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
        }));
        return res.status(200).json({
            latestThemes: enhancedThemes,
            latestQuestions: enhancedQuestions,
            latestOpinions: opinionsWithQuestions,
        });
    }
    catch (error) {
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
        const latestOpinions = await Promise.all(allOpinions.map(async (opinion) => {
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
                questionTitle: questionLink?.questionId?.questionText ||
                    opinion.themeId?.title ||
                    "質問",
                questionTagline: questionLink?.questionId?.tagLine || "",
                questionId: questionLink?.questionId?._id || "",
                createdAt: opinion.createdAt,
                likeCount,
                commentCount: 0,
            };
        }));
        return res.status(200).json(latestOpinions);
    }
    catch (error) {
        console.error("Error fetching opinions:", error);
        return res.status(500).json({
            message: "Error fetching opinions",
            error: error.message,
        });
    }
};
//# sourceMappingURL=topPageController.js.map