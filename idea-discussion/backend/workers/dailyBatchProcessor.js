import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";
import SharpQuestion from "../models/SharpQuestion.js";
import QuestionLink from "../models/QuestionLink.js";
import Like from "../models/Like.js";
import Theme from "../models/Theme.js";
import { generateSharpQuestions } from "./questionGenerator.js";

/**
 * 品質スコアを計算する
 * relevanceScoreとLike数を組み合わせて総合スコアを算出
 */
async function calculateQualityScore(itemId, itemType, relevanceScore = 0) {
  const likeCount = await Like.countDocuments({
    targetId: itemId,
    targetType: itemType,
  });

  // 品質スコア = relevanceScore (0-1) × 0.7 + Like数正規化 (0-1) × 0.3
  // Like数は最大10で正規化（10以上は1.0として扱う）
  const normalizedLikeScore = Math.min(likeCount / 10, 1.0);
  const qualityScore = relevanceScore * 0.7 + normalizedLikeScore * 0.3;

  return {
    qualityScore,
    likeCount,
    relevanceScore,
  };
}

/**
 * テーマごとに品質の高い意見を選別する
 * チャット時に参照する意見リストを準備
 */
async function selectQualityOpinionsForTheme(themeId) {
  console.log(
    `[DailyBatchProcessor] Selecting quality opinions for theme ${themeId}...`
  );

  try {
    // 1. テーマに関連するすべてのQuestionLinkを取得
    const themeQuestions = await SharpQuestion.find({ themeId }).select("_id");
    const questionIds = themeQuestions.map((q) => q._id);

    if (questionIds.length === 0) {
      console.log(
        `[DailyBatchProcessor] No questions found for theme ${themeId}, skipping...`
      );
      return { problems: [], solutions: [] };
    }

    const allLinks = await QuestionLink.find({
      questionId: { $in: questionIds },
    });

    // 2. 各意見の品質スコアを計算
    const problemScores = [];
    const solutionScores = [];

    for (const link of allLinks) {
      const quality = await calculateQualityScore(
        link.linkedItemId,
        link.linkedItemType,
        link.relevanceScore || 0
      );

      if (link.linkedItemType === "problem") {
        problemScores.push({
          itemId: link.linkedItemId,
          qualityScore: quality.qualityScore,
          likeCount: quality.likeCount,
          relevanceScore: quality.relevanceScore,
        });
      } else if (link.linkedItemType === "solution") {
        solutionScores.push({
          itemId: link.linkedItemId,
          qualityScore: quality.qualityScore,
          likeCount: quality.likeCount,
          relevanceScore: quality.relevanceScore,
        });
      }
    }

    // 3. 品質スコアでソート（上位を選別）
    problemScores.sort((a, b) => b.qualityScore - a.qualityScore);
    solutionScores.sort((a, b) => b.qualityScore - a.qualityScore);

    // 4. 上位N件を選別（例: 品質スコア0.3以上、最大20件）
    const qualityThreshold = 0.3;
    const maxItems = 20;

    const selectedProblems = problemScores
      .filter((item) => item.qualityScore >= qualityThreshold)
      .slice(0, maxItems)
      .map((item) => item.itemId);

    const selectedSolutions = solutionScores
      .filter((item) => item.qualityScore >= qualityThreshold)
      .slice(0, maxItems)
      .map((item) => item.itemId);

    console.log(
      `[DailyBatchProcessor] Selected ${selectedProblems.length} problems and ${selectedSolutions.length} solutions for theme ${themeId}`
    );

    return {
      problems: selectedProblems,
      solutions: selectedSolutions,
    };
  } catch (error) {
    console.error(
      `[DailyBatchProcessor] Error selecting quality opinions for theme ${themeId}:`,
      error
    );
    return { problems: [], solutions: [] };
  }
}

/**
 * シャープな問いの自動生成
 * 一定数の課題が蓄積されたら自動生成
 */
async function autoGenerateSharpQuestions(themeId) {
  console.log(
    `[DailyBatchProcessor] Checking if sharp questions should be generated for theme ${themeId}...`
  );

  try {
    const problemCount = await Problem.countDocuments({ themeId });
    const existingQuestionCount = await SharpQuestion.countDocuments({
      themeId,
    });

    // 課題が10件以上あり、問いが5件未満の場合、自動生成
    const shouldGenerate =
      problemCount >= 10 && existingQuestionCount < 5;

    if (shouldGenerate) {
      console.log(
        `[DailyBatchProcessor] Auto-generating sharp questions for theme ${themeId} (${problemCount} problems found)...`
      );
      await generateSharpQuestions(themeId);
    } else {
      console.log(
        `[DailyBatchProcessor] Skipping auto-generation for theme ${themeId} (problems: ${problemCount}, questions: ${existingQuestionCount})`
      );
    }
  } catch (error) {
    console.error(
      `[DailyBatchProcessor] Error in auto-generating sharp questions for theme ${themeId}:`,
      error
    );
  }
}

/**
 * 1日1回実行されるバッチ処理
 * 
 * 【処理対象のテーマ】
 * - 管理画面でアクティブ設定（isActive: true）されているテーマのみを処理対象とする
 * - 非アクティブ（isActive: false）のテーマは処理をスキップする
 * - 判定はバッチ処理実行時点でのisActiveの値で行う
 * - つまり、その日にアクティブかどうかで判定される
 * 
 * 【処理内容】
 * 1. シャープな問いの自動生成（条件を満たす場合）
 * 2. 品質の高い意見の選別（チャット時に参照する意見リストの準備）
 */
export async function runDailyBatch() {
  console.log("[DailyBatchProcessor] Starting daily batch processing...");

  try {
    // 1. アクティブなテーマのみを取得
    // 管理画面でアクティブ設定されているテーマのみが処理対象
    // 非アクティブなテーマは自動的にスキップされる
    const activeThemes = await Theme.find({ isActive: true });

    // 全テーマ数を取得（ログ用）
    const totalThemes = await Theme.countDocuments({});

    console.log(
      `[DailyBatchProcessor] Found ${activeThemes.length} active themes out of ${totalThemes} total themes`
    );

    if (activeThemes.length === 0) {
      console.log(
        "[DailyBatchProcessor] No active themes found. Skipping batch processing."
      );
      return;
    }

    // 2. 各アクティブなテーマに対して処理を実行
    for (const theme of activeThemes) {
      console.log(
        `[DailyBatchProcessor] Processing active theme: ${theme.title} (${theme._id})`
      );

      // 2-1. シャープな問いの自動生成
      await autoGenerateSharpQuestions(theme._id);

      // 2-2. 品質の高い意見の選別
      // 注: 現時点では選別結果を保存するモデルがないため、
      // チャットコントローラーで直接参照する方式を採用
      // 将来的に、選別結果をキャッシュするモデルを追加することも可能
    }

    console.log(
      `[DailyBatchProcessor] Daily batch processing completed for ${activeThemes.length} active theme(s).`
    );
  } catch (error) {
    console.error("[DailyBatchProcessor] Error in daily batch processing:", error);
  }
}

/**
 * テーマごとに品質の高い意見を取得（チャット時に使用）
 * バッチ処理で選別された意見を参照
 */
export async function getQualityOpinionsForChat(themeId, limit = 10) {
  try {
    // テーマに関連するQuestionLinkを取得
    const themeQuestions = await SharpQuestion.find({ themeId }).select("_id");
    const questionIds = themeQuestions.map((q) => q._id);

    if (questionIds.length === 0) {
      return { problems: [], solutions: [] };
    }

    const allLinks = await QuestionLink.find({
      questionId: { $in: questionIds },
    });

    // 品質スコアを計算してソート
    const problemScores = [];
    const solutionScores = [];

    for (const link of allLinks) {
      const quality = await calculateQualityScore(
        link.linkedItemId,
        link.linkedItemType,
        link.relevanceScore || 0
      );

      if (link.linkedItemType === "problem") {
        problemScores.push({
          itemId: link.linkedItemId,
          qualityScore: quality.qualityScore,
        });
      } else if (link.linkedItemType === "solution") {
        solutionScores.push({
          itemId: link.linkedItemId,
          qualityScore: quality.qualityScore,
        });
      }
    }

    // 品質スコアでソートして上位を取得
    problemScores.sort((a, b) => b.qualityScore - a.qualityScore);
    solutionScores.sort((a, b) => b.qualityScore - a.qualityScore);

    const selectedProblemIds = problemScores
      .filter((item) => item.qualityScore >= 0.3)
      .slice(0, limit)
      .map((item) => item.itemId);

    const selectedSolutionIds = solutionScores
      .filter((item) => item.qualityScore >= 0.3)
      .slice(0, limit)
      .map((item) => item.itemId);

    // 実際のProblem/Solutionを取得
    const problems = await Problem.find({
      _id: { $in: selectedProblemIds },
    });
    const solutions = await Solution.find({
      _id: { $in: selectedSolutionIds },
    });

    return { problems, solutions };
  } catch (error) {
    console.error(
      `[DailyBatchProcessor] Error getting quality opinions for chat:`,
      error
    );
    return { problems: [], solutions: [] };
  }
}
