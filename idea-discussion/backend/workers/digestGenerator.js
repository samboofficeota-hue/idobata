import DigestDraft from "../models/DigestDraft.js";
import PolicyDraft from "../models/PolicyDraft.js";
import Problem from "../models/Problem.js";
import QuestionLink from "../models/QuestionLink.js";
import SharpQuestion from "../models/SharpQuestion.js";
import Solution from "../models/Solution.js";
import { DEFAULT_MODEL, callLLM } from "../services/llmService.js";

/** 問いの contextSets から代表1件を取得（PolicyDraft と同ロジック） */
function getRepresentativeContextSet(question) {
  const sets = question?.contextSets;
  if (!Array.isArray(sets) || sets.length === 0) return null;
  for (const s of sets) {
    const t = (s?.target ?? "").trim();
    const p = (s?.purpose ?? "").trim();
    const e = (s?.expectedEffect ?? "").trim();
    if (t || p || e) return { target: t, purpose: p, expectedEffect: e };
  }
  return null;
}

async function generateDigestDraft(questionId) {
  console.log(
    `[DigestGenerator] Starting digest draft generation for questionId: ${questionId}`
  );
  try {
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      console.error(
        `[DigestGenerator] SharpQuestion not found for id: ${questionId}`
      );
      return;
    }
    console.log(`[DigestGenerator] Found question: "${question.questionText}"`);

    const links = await QuestionLink.find({ questionId: questionId });

    const problemLinks = links.filter(
      (link) => link.linkedItemType === "problem"
    );
    const solutionLinks = links.filter(
      (link) => link.linkedItemType === "solution"
    );

    problemLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
    solutionLinks.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    const problemIds = problemLinks.map((link) => link.linkedItemId);
    const solutionIds = solutionLinks.map((link) => link.linkedItemId);

    const relevanceScoreMap = new Map();
    for (const link of links) {
      relevanceScoreMap.set(
        link.linkedItemId.toString(),
        link.relevanceScore || 0
      );
    }

    const problems = await Problem.find({ _id: { $in: problemIds } });
    const solutions = await Solution.find({ _id: { $in: solutionIds } });

    const sortedProblems = problemIds
      .map((id) => problems.find((p) => p._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    const sortedSolutions = solutionIds
      .map((id) => solutions.find((s) => s._id.toString() === id.toString()))
      .filter(Boolean); // Remove any undefined values

    const problemStatements = sortedProblems.map((p) => p.statement);
    const solutionStatements = sortedSolutions.map((s) => s.statement);

    console.log(
      `[DigestGenerator] Found ${problemStatements.length} related problems and ${solutionStatements.length} related solutions, sorted by relevance.`
    );

    const latestPolicyDraft = await PolicyDraft.findOne({
      questionId: questionId,
    })
      .sort({ createdAt: -1 })
      .limit(1);

    const hasPolicyDraft = !!latestPolicyDraft;
    
    if (hasPolicyDraft) {
      console.log(
        `[DigestGenerator] Found latest policy draft: "${latestPolicyDraft.title}"`
      );
    } else {
      console.log(
        `[DigestGenerator] No policy draft found for questionId: ${questionId}. Generating digest without policy draft.`
      );
    }

    // 「みんなのアイディア」の構造ルール。PolicyDraftの有無で2つのプロンプトが
    // 分岐するため、共通部分は定数に切り出して指示の食い違いを防ぐ。
    const IDEA_STRUCTURE_RULES = `**重要：Markdownコンテンツの構造について**
    - 全体を「解決アイディア」を軸に構成してください。課題の羅列にしないこと。
    - 冒頭に「## まとめ」を置き、この問いで何が議論されているかを2〜4文で説明してください。
    - 続けて、集まった意見から導かれる解決アイディアを3〜6個、それぞれ独立した見出しで並べてください。見出しは「## アイディア：〔短いタイトル〕」の形式にしてください。
    - 各アイディアには、次の3点をこの順で必ず含めてください（それぞれ1〜3文）：
      - **課題**：どんな困りごとに応えるものか
      - **すること**：具体的に何をするのか
      - **解決されること**：それによって何がどう変わるのか
    - 各アイディアは、実際に集まった意見に基づいて書いてください。意見に出ていない施策を創作しないこと。
    - 賛否が分かれているアイディアには「**論点**」を1文添えてください。賛成意見だけを書かないこと。
    - 全体の長さは1500〜2500文字程度にしてください。
    - タイトル「市民の意見レポート」や「問い」というセクションは含めないでください。
    - contentフィールドには、上記の構造に従ったMarkdownコンテンツを記述してください`;

    // プロンプトをPolicyDraftの有無に応じて調整
    const systemPrompt = hasPolicyDraft
      ? `あなたはAIアシスタントです。あなたの任務は、中心的な問い（「私たちはどのようにして...できるか？」）、その問いに関連する問題点と解決策、そして政策ドラフトを分析し、一般市民向けの「みんなのアイディア」を作成することです。これは課題の報告書ではなく、集まった意見から導かれる解決アイディアを紹介するものです。

あなたの出力は、'title'（文字列）と'content'（文字列）のキーを含むJSONオブジェクトにする必要があります。

以下のガイドラインに従ってください：

1. あなたは政策レポートとそのデータを読みこなせる専門家であると同時に、それを一般の人向けに噛み砕いて伝えるライターでもあります。政策レポートより平易な表現を使いましょう。

2. 複雑な概念や専門用語を避け、平易な言葉で説明してください。

3. 重要なポイントを強調し、細かい詳細よりも全体像を伝えることに重点を置いてください。

4. なぜこの政策が重要なのか、どのように市民の生活に影響するのかを明確に説明してください。

5. 視覚的に読みやすい構造（見出し、箇条書き、短い段落など）を使用してください。

6. 正確さを保ちながらも、簡潔さを優先してください。

7. 各アイディアには、それがどんな課題に応えるものかを簡潔に添えてください。

8. 専門的な分析や複雑なトレードオフの詳細よりも、そのアイディアで何が実現できるかに焦点を当ててください。

9. 重要な用語やコンセプトを説明するための簡単な例や比喩を含めてください。

10. ${IDEA_STRUCTURE_RULES}

応答は、"title"（文字列、ダイジェスト全体に適したタイトル）と "content"（文字列、Markdownで適切にフォーマットされた内容）のキーを含むJSONオブジェクトのみで行ってください。JSON構造外に他のテキストや説明を含めないでください。`
      : `あなたはAIアシスタントです。あなたの任務は、中心的な問い（「私たちはどのようにして...できるか？」）と、その問いに関連する問題点と解決策を分析し、一般市民向けの「みんなのアイディア」を作成することです。これは課題の報告書ではなく、集まった意見から導かれる解決アイディアを紹介するものです。

あなたの出力は、'title'（文字列）と'content'（文字列）のキーを含むJSONオブジェクトにする必要があります。

以下のガイドラインに従ってください：

1. 集まった意見から解決アイディアを組み立て、一般市民向けにわかりやすく紹介してください。課題の列挙で終わらせないこと。

2. 複雑な概念や専門用語を避け、平易な言葉で説明してください。

3. 重要なポイントを強調し、細かい詳細よりも全体像を伝えることに重点を置いてください。

4. なぜこの問いが重要なのか、どのように市民の生活に影響するのかを明確に説明してください。

5. 視覚的に読みやすい構造（見出し、箇条書き、短い段落など）を使用してください。

6. 正確さを保ちながらも、簡潔さを優先してください。

7. 各アイディアには、それがどんな課題に応えるものかを簡潔に添えてください。

8. 専門的な分析よりも、市民の声と、そのアイディアで何が実現できるかに焦点を当ててください。

9. 重要な用語やコンセプトを説明するための簡単な例や比喩を含めてください。

10. ${IDEA_STRUCTURE_RULES}

応答は、"title"（文字列、ダイジェスト全体に適したタイトル）と "content"（文字列、Markdownで適切にフォーマットされた内容）のキーを含むJSONオブジェクトのみで行ってください。JSON構造外に他のテキストや説明を含めないでください。`;

    const repCtx =
      latestPolicyDraft?.representativeContextSet ||
      getRepresentativeContextSet(question);
    const hasRepCtx =
      repCtx &&
      (repCtx.target || repCtx.purpose || repCtx.expectedEffect);
    const policyContextBlock = hasRepCtx
      ? `
Policy context (who and why — use when summarizing):
- 対象 (target): ${repCtx.target || "—"}
- 目的 (purpose): ${repCtx.purpose || "—"}
- 期待効果 (expected effect): ${repCtx.expectedEffect || "—"}
`
      : "";

    const userContent = hasPolicyDraft
      ? `Generate a digest for the following:

Question: ${question.questionText}
${policyContextBlock}

Related Problems (sorted by relevance - higher items are more relevant to the question):
${problemStatements.length > 0 ? problemStatements.map((p) => `- ${p}`).join("\n") : "- None provided"}

Related Solutions (sorted by relevance - higher items are more relevant to the question):
${solutionStatements.length > 0 ? solutionStatements.map((s) => `- ${s}`).join("\n") : "- None provided"}

Policy Report:
Title: ${latestPolicyDraft.title}
Content: ${latestPolicyDraft.content}

Please provide the output as a JSON object with "title" and "content" keys. Structure the content around concrete solution ideas (each with 課題 / すること / 解決されること), not as a list of problems. It should be much more accessible to general readers than the policy report.${hasRepCtx ? " Emphasize who this is for and what change is expected where relevant." : ""}`
      : `Generate a digest for the following:

Question: ${question.questionText}
${policyContextBlock}

Related Problems (sorted by relevance - higher items are more relevant to the question):
${problemStatements.length > 0 ? problemStatements.map((p) => `- ${p}`).join("\n") : "- None provided"}

Related Solutions (sorted by relevance - higher items are more relevant to the question):
${solutionStatements.length > 0 ? solutionStatements.map((s) => `- ${s}`).join("\n") : "- None provided"}

Please provide the output as a JSON object with "title" and "content" keys. Structure the content around concrete solution ideas derived from the collected opinions (each with 課題 / すること / 解決されること), not as a list of problems.${hasRepCtx ? " Align the ideas with the target, purpose, and expected effect above where relevant." : ""}`;

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

    console.log("[DigestGenerator] Calling LLM to generate digest draft...");
    // 1500〜2500文字のMarkdownを要求するため、既定の2048では不足する
    const llmResponse = await callLLM(messages, true, DEFAULT_MODEL, {
      max_tokens: 8000,
    });

    if (
      !llmResponse ||
      typeof llmResponse !== "object" ||
      !llmResponse.title ||
      !llmResponse.content
    ) {
      console.error(
        "[DigestGenerator] Failed to get valid JSON response from LLM:",
        llmResponse
      );
      throw new Error(
        "Invalid response format from LLM for digest draft generation."
      );
    }

    console.log(
      `[DigestGenerator] LLM generated digest titled: "${llmResponse.title}"`
    );

    const digestRepCtx =
      (hasPolicyDraft && latestPolicyDraft?.representativeContextSet) ||
      getRepresentativeContextSet(question);
    const representativeContextSet =
      digestRepCtx &&
      (digestRepCtx.target || digestRepCtx.purpose || digestRepCtx.expectedEffect)
        ? {
            target: digestRepCtx.target || "",
            purpose: digestRepCtx.purpose || "",
            expectedEffect: digestRepCtx.expectedEffect || "",
          }
        : undefined;

    const newDraft = new DigestDraft({
      questionId: questionId,
      policyDraftId: hasPolicyDraft ? latestPolicyDraft._id : null,
      title: llmResponse.title,
      content: llmResponse.content,
      sourceProblemIds: problemIds,
      sourceSolutionIds: solutionIds,
      representativeContextSet,
      version: 1,
    });

    await newDraft.save();
    console.log(
      `[DigestGenerator] Successfully saved digest draft with ID: ${newDraft._id}`
    );
  } catch (error) {
    console.error(
      `[DigestGenerator] Error generating digest draft for questionId ${questionId}:`,
      error
    );
  }
}

export { generateDigestDraft };
