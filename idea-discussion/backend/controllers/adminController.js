import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { generateDebateAnalysisTask } from "../workers/debateAnalysisGenerator.js";
import { generateDigestDraft } from "../workers/digestGenerator.js";
import { generateSharpQuestions } from "../workers/questionGenerator.js";

// Controller to trigger the sharp question generation process for all active themes
// Note: This is a legacy function. Use triggerQuestionGenerationByTheme for theme-specific generation.
const triggerQuestionGeneration = async (req, res) => {
  console.log(
    "[AdminController] Received request to generate sharp questions for all active themes."
  );
  try {
    // Get all active themes
    const Theme = (await import("../models/Theme.js")).default;
    const activeThemes = await Theme.find({ isActive: true });

    if (activeThemes.length === 0) {
      return res.status(404).json({
        message: "No active themes found.",
      });
    }

    console.log(
      `[AdminController] Found ${activeThemes.length} active themes. Generating questions for each...`
    );

    // Generate questions for each active theme
    const generationPromises = activeThemes.map((theme) =>
      generateSharpQuestions(theme._id)
        .then(() => {
          console.log(
            `[AdminController] Successfully generated questions for theme ${theme._id}`
          );
          return {
            themeId: theme._id,
            status: "success",
          };
        })
        .catch((err) => {
          console.error(
            `[AdminController] Error generating questions for theme ${theme._id}:`,
            err
          );
          return {
            themeId: theme._id,
            status: "error",
            error: err.message,
          };
        })
    );

    // Execute all generations in parallel and wait for completion
    const results = await Promise.allSettled(generationPromises);

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value?.status === "success"
    ).length;
    const errorCount = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && r.value?.status === "error")
    ).length;

    console.log(
      `[AdminController] Question generation completed: ${successCount} succeeded, ${errorCount} failed out of ${results.length} total themes`
    );

    // エラーが発生した場合、詳細をログに記録
    if (errorCount > 0) {
      const errors = results
        .map((r, index) => {
          if (r.status === "rejected") {
            return { index, error: r.reason?.message || String(r.reason) };
          }
          if (r.status === "fulfilled" && r.value?.status === "error") {
            return {
              index,
              themeId: r.value.themeId,
              error: r.value.error,
            };
          }
          return null;
        })
        .filter(Boolean);

      console.error(
        "[AdminController] Failed themes details:",
        JSON.stringify(errors, null, 2)
      );
    }

    res.status(202).json({
      message: `Sharp question generation started for ${activeThemes.length} active theme(s).`,
      themeCount: activeThemes.length,
    });
  } catch (error) {
    console.error(
      "[AdminController] Error triggering question generation:",
      error
    );
    res
      .status(500)
      .json({ message: "Failed to start sharp question generation process." });
  }
};

const getProblemsByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(`[AdminController] Fetching problems for theme ${themeId}`);
  try {
    const problems = await Problem.find({ themeId }).sort({ createdAt: -1 });
    res.status(200).json(problems);
  } catch (error) {
    console.error(
      `[AdminController] Error fetching problems for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch problems for theme",
      error: error.message,
    });
  }
};

const getSolutionsByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(`[AdminController] Fetching solutions for theme ${themeId}`);
  try {
    const solutions = await Solution.find({ themeId }).sort({ createdAt: -1 });
    res.status(200).json(solutions);
  } catch (error) {
    console.error(
      `[AdminController] Error fetching solutions for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to fetch solutions for theme",
      error: error.message,
    });
  }
};

const triggerQuestionGenerationByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(
    `[AdminController] Received request to generate sharp questions for theme ${themeId}`
  );
  try {
    await generateSharpQuestions(themeId);

    res.status(202).json({
      message: "Sharp question generation process started successfully.",
    });
  } catch (error) {
    console.error(
      `[AdminController] Error triggering question generation for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to start sharp question generation process for theme",
      error: error.message,
      details: error.stack,
    });
  }
};

// テーマごとに意見まとめ（Debate Analysis / Opinion Summary）を一括生成
const triggerOpinionSummaryGenerationByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(
    `[AdminController] Received request to generate opinion summaries for theme ${themeId}`
  );

  try {
    // テーマ内のすべての問いを取得
    const questions = await SharpQuestion.find({ themeId });

    if (questions.length === 0) {
      return res.status(404).json({
        message:
          "No questions found for this theme. Please generate questions first.",
      });
    }

    console.log(
      `[AdminController] Found ${questions.length} questions for theme ${themeId}`
    );

    // 各問いに対して意見まとめを非同期で生成
    const generationPromises = [];

    for (const question of questions) {
      // Debate Analysis を生成
      generationPromises.push(
        generateDebateAnalysisTask(question._id)
          .then(() => {
            console.log(
              `[AdminController] Successfully generated debate analysis for question ${question._id}`
            );
            return {
              type: "debateAnalysis",
              questionId: question._id,
              status: "success",
            };
          })
          .catch((err) => {
            console.error(
              `[AdminController] Error generating debate analysis for question ${question._id}:`,
              err
            );
            return {
              type: "debateAnalysis",
              questionId: question._id,
              status: "error",
              error: err.message,
            };
          })
      );

      // Opinion Summary (Digest) を生成（Policy Draftが存在する場合のみ）
      generationPromises.push(
        generateDigestDraft(question._id)
          .then(() => {
            console.log(
              `[AdminController] Successfully generated digest for question ${question._id}`
            );
            return {
              type: "digest",
              questionId: question._id,
              status: "success",
            };
          })
          .catch((err) => {
            console.error(
              `[AdminController] Error generating digest for question ${question._id}:`,
              err
            );
            return {
              type: "digest",
              questionId: question._id,
              status: "error",
              error: err.message,
            };
          })
      );
    }

    // すべての生成を並列実行（非同期）
    // Promise.allSettledを使用して、すべてのpromiseが完了するまで待つ
    // エラーが発生しても処理を継続し、結果をログに記録
    Promise.allSettled(generationPromises)
      .then((results) => {
        const successCount = results.filter(
          (r) => r.status === "fulfilled" && r.value?.status === "success"
        ).length;
        const errorCount = results.filter(
          (r) =>
            r.status === "rejected" ||
            (r.status === "fulfilled" && r.value?.status === "error")
        ).length;

        console.log(
          `[AdminController] Opinion summary generation completed: ${successCount} succeeded, ${errorCount} failed out of ${results.length} total tasks`
        );

        // エラーが発生した場合、詳細をログに記録
        if (errorCount > 0) {
          const errors = results
            .map((r, index) => {
              if (r.status === "rejected") {
                return { index, error: r.reason?.message || String(r.reason) };
              }
              if (r.status === "fulfilled" && r.value?.status === "error") {
                return {
                  index,
                  questionId: r.value.questionId,
                  type: r.value.type,
                  error: r.value.error,
                };
              }
              return null;
            })
            .filter(Boolean);

          console.error(
            "[AdminController] Failed tasks details:",
            JSON.stringify(errors, null, 2)
          );
        }
      })
      .catch((err) => {
        console.error(
          "[AdminController] Unexpected error during batch opinion summary generation:",
          err
        );
      });

    res.status(202).json({
      message: `Opinion summary generation started for ${questions.length} questions.`,
      questionCount: questions.length,
      taskCount: generationPromises.length,
    });
  } catch (error) {
    console.error(
      `[AdminController] Error triggering opinion summary generation for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to start opinion summary generation for theme",
      error: error.message,
    });
  }
};

// テーマ全体のダウンロード用アウトプットを生成
const generateThemeDownloadOutput = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  console.log(
    `[AdminController] Received request to generate download output for theme ${themeId}`
  );

  try {
    // テーマ情報を取得
    const Theme = (await import("../models/Theme.js")).default;
    const theme = await Theme.findById(themeId);

    if (!theme) {
      return res.status(404).json({ message: "Theme not found" });
    }

    // テーマ内のすべての問いを取得
    const questions = await SharpQuestion.find({ themeId }).sort({
      createdAt: -1,
    });

    // 各問いの関連データを取得
    const QuestionLink = (await import("../models/QuestionLink.js")).default;
    const DebateAnalysis = (await import("../models/DebateAnalysis.js"))
      .default;
    const DigestDraft = (await import("../models/DigestDraft.js")).default;
    const PolicyDraft = (await import("../models/PolicyDraft.js")).default;

    const outputData = {
      theme: {
        id: theme._id,
        title: theme.title,
        description: theme.description,
        createdAt: theme.createdAt,
      },
      questions: [],
      summary: {
        totalQuestions: questions.length,
        totalProblems: 0,
        totalSolutions: 0,
        generatedAt: new Date().toISOString(),
      },
    };

    // すべてのquestionIdを取得
    const questionIds = questions.map((q) => q._id);

    // 一括でクエリを実行（N+1クエリ問題を解決）
    const [allLinks, allDebateAnalyses, allDigestDrafts, allPolicyDrafts] =
      await Promise.all([
        QuestionLink.find({ questionId: { $in: questionIds } }),
        DebateAnalysis.find({ questionId: { $in: questionIds } })
          .sort({ createdAt: -1 })
          .lean(),
        DigestDraft.find({ questionId: { $in: questionIds } })
          .sort({ createdAt: -1 })
          .lean(),
        PolicyDraft.find({ questionId: { $in: questionIds } })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

    // メモリ上でマッピング（questionIdをキーとして）
    const linksMap = new Map();
    for (const link of allLinks) {
      const qId = link.questionId.toString();
      if (!linksMap.has(qId)) {
        linksMap.set(qId, []);
      }
      linksMap.get(qId).push(link);
    }

    // DebateAnalysisをquestionIdごとに最新の1件のみ保持
    const debateAnalysisMap = new Map();
    for (const analysis of allDebateAnalyses) {
      const qId = analysis.questionId.toString();
      if (!debateAnalysisMap.has(qId)) {
        debateAnalysisMap.set(qId, analysis);
      }
    }

    // DigestDraftをquestionIdごとに最新の1件のみ保持
    const digestDraftMap = new Map();
    for (const draft of allDigestDrafts) {
      const qId = draft.questionId.toString();
      if (!digestDraftMap.has(qId)) {
        digestDraftMap.set(qId, draft);
      }
    }

    // PolicyDraftをquestionIdごとに最新の1件のみ保持
    const policyDraftMap = new Map();
    for (const draft of allPolicyDrafts) {
      const qId = draft.questionId.toString();
      if (!policyDraftMap.has(qId)) {
        policyDraftMap.set(qId, draft);
      }
    }

    let totalProblems = 0;
    let totalSolutions = 0;

    for (const question of questions) {
      const questionIdStr = question._id.toString();
      const links = linksMap.get(questionIdStr) || [];
      const problemLinks = links.filter(
        (link) => link.linkedItemType === "problem"
      );
      const solutionLinks = links.filter(
        (link) => link.linkedItemType === "solution"
      );

      totalProblems += problemLinks.length;
      totalSolutions += solutionLinks.length;

      const debateAnalysis = debateAnalysisMap.get(questionIdStr) || null;
      const digestDraft = digestDraftMap.get(questionIdStr) || null;
      const policyDraft = policyDraftMap.get(questionIdStr) || null;

      const questionData = {
        id: question._id,
        questionText: question.questionText,
        tagLine: question.tagLine,
        tags: question.tags,
        createdAt: question.createdAt,
        relatedProblemsCount: problemLinks.length,
        relatedSolutionsCount: solutionLinks.length,
        debateAnalysis: debateAnalysis
          ? {
              axes: debateAnalysis.axes,
              agreementPoints: debateAnalysis.agreementPoints,
              disagreementPoints: debateAnalysis.disagreementPoints,
              createdAt: debateAnalysis.createdAt,
            }
          : null,
        opinionSummary: digestDraft
          ? {
              title: digestDraft.title,
              content: digestDraft.content,
              createdAt: digestDraft.createdAt,
            }
          : null,
        policyDraft: policyDraft
          ? {
              title: policyDraft.title,
              content: policyDraft.content,
              createdAt: policyDraft.createdAt,
            }
          : null,
      };

      outputData.questions.push(questionData);
    }

    outputData.summary.totalProblems = totalProblems;
    outputData.summary.totalSolutions = totalSolutions;

    res.status(200).json(outputData);
  } catch (error) {
    console.error(
      `[AdminController] Error generating download output for theme ${themeId}:`,
      error
    );
    res.status(500).json({
      message: "Failed to generate download output for theme",
      error: error.message,
    });
  }
};

export {
  triggerQuestionGeneration,
  getProblemsByTheme,
  getSolutionsByTheme,
  triggerQuestionGenerationByTheme,
  triggerOpinionSummaryGenerationByTheme,
  generateThemeDownloadOutput,
};
