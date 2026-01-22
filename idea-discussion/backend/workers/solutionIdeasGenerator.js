import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { callLLM } from "../services/llmService.js";

/**
 * Generate solution ideas from all related solutions for a question
 * This aggregates individual solutions into broader solution ideas (maximum 4)
 */
async function generateSolutionIdeas(questionId) {
  console.log(
    `[SolutionIdeasGenerator] Starting solution ideas generation for questionId: ${questionId}`
  );
  try {
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      console.error(
        `[SolutionIdeasGenerator] SharpQuestion not found for id: ${questionId}`
      );
      return null;
    }
    console.log(
      `[SolutionIdeasGenerator] Found question: "${question.questionText}"`
    );

    // Get all related solutions via QuestionLink
    const links = await QuestionLink.find({ questionId: questionId });
    const solutionLinks = links.filter(
      (link) => link.linkedItemType === "solution"
    );

    // Sort by relevance score
    solutionLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    const solutionIds = solutionLinks.map((link) => link.linkedItemId);
    const solutions = await Solution.find({ _id: { $in: solutionIds } });

    const sortedSolutions = solutionIds
      .map((id) => solutions.find((s) => s._id.toString() === id.toString()))
      .filter(Boolean);

    const solutionStatements = sortedSolutions.map((s) => s.statement);

    console.log(
      `[SolutionIdeasGenerator] Found ${solutionStatements.length} related solutions`
    );

    if (solutionStatements.length === 0) {
      console.log(
        `[SolutionIdeasGenerator] No solutions found, returning empty array`
      );
      return [];
    }

    // Get related problems for context
    const problemLinks = links.filter(
      (link) => link.linkedItemType === "problem"
    );
    problemLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    const problemIds = problemLinks.map((link) => link.linkedItemId);
    const problems = await Problem.find({ _id: { $in: problemIds } });
    const sortedProblems = problemIds
      .map((id) => problems.find((p) => p._id.toString() === id.toString()))
      .filter(Boolean);
    const problemStatements = sortedProblems.map((p) => p.statement);

    // Build prompt for generating solution ideas
    const systemPrompt = `あなたはAIアシスタントです。あなたの任務は、複数の個別の解決策を分析し、それらを統合・要約して、より広範な「解決アイディア」を生成することです。

以下のガイドラインに従ってください：

1. 個別の解決策を分析し、共通のテーマや方向性を見つけてください。
2. 類似した解決策を統合し、より包括的な解決アイディアとして表現してください。
3. 各解決アイディアは、複数の個別の解決策から抽出された本質的な提案として記述してください。
4. 個人の意見ではなく、「みんなの意見」から抽出された共通の解決アイディアとして表現してください。
5. 各解決アイディアは、簡潔で明確に記述してください（1〜2文程度）。
6. 最大4つの解決アイディアを生成してください。
7. 関連度の高い解決策を優先的に考慮してください。

出力形式：
- JSON形式で出力してください
- "solutionIdeas"というキーに、解決アイディアの配列を含めてください
- 各解決アイディアは文字列として記述してください

例：
{
  "solutionIdeas": [
    "デジタル化推進のための包括的な支援体制の構築",
    "高齢者向けのアクセシビリティ向上施策",
    "地域コミュニティとの連携強化",
    "持続可能な運営体制の確立"
  ]
}`;

    const userContent = `以下の問いと、それに関連する課題・解決策を分析し、解決アイディアを生成してください。

問い: ${question.questionText}

関連する課題:
${problemStatements.length > 0 ? problemStatements.map((p, i) => `${i + 1}. ${p}`).join("\n") : "- 課題は提供されていません"}

個別の解決策（関連度順）:
${solutionStatements.length > 0 ? solutionStatements.map((s, i) => `${i + 1}. ${s}`).join("\n") : "- 解決策は提供されていません"}

上記の個別の解決策を分析し、それらを統合・要約して、最大4つの「解決アイディア」を生成してください。
各解決アイディアは、複数の個別の解決策から抽出された本質的な提案として、簡潔に記述してください。
個人の意見ではなく、「みんなの意見」から抽出された共通の解決アイディアとして表現してください。`;

    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userContent,
      },
    ];

    console.log(
      "[SolutionIdeasGenerator] Calling LLM to generate solution ideas..."
    );
    const llmResponse = await callLLM(messages, true, "gpt-5-mini"); // Request JSON output

    if (
      !llmResponse ||
      typeof llmResponse !== "object" ||
      !llmResponse.solutionIdeas ||
      !Array.isArray(llmResponse.solutionIdeas)
    ) {
      console.error(
        "[SolutionIdeasGenerator] Failed to get valid JSON response from LLM:",
        llmResponse
      );
      // Fallback: return top 4 solutions as ideas
      return solutionStatements.slice(0, 4).map((statement, index) => ({
        id: `fallback-${index}`,
        idea: statement,
      }));
    }

    // Limit to maximum 4 ideas
    const solutionIdeas = llmResponse.solutionIdeas
      .slice(0, 4)
      .map((idea, index) => ({
        id: `idea-${index}`,
        idea: idea,
      }));

    console.log(
      `[SolutionIdeasGenerator] Generated ${solutionIdeas.length} solution ideas`
    );

    return solutionIdeas;
  } catch (error) {
    console.error(
      `[SolutionIdeasGenerator] Error generating solution ideas for questionId ${questionId}:`,
      error
    );
    // Return empty array on error
    return [];
  }
}

export { generateSolutionIdeas };
