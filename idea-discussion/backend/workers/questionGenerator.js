import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";
import SharpQuestion from "../models/SharpQuestion.js";
import { callLLM } from "../services/llmService.js";
import { linkQuestionToAllItems } from "./linkingWorker.js"; // Import the linking function

const TAGLINE_MAX_LENGTH = 15;
const QUESTION_MAX_LENGTH = 50;

/** 重複判定用: 空白の正規化（trim + 連続空白を1つに）。表記ゆれで別問いとみなさないため */
function normalizeQuestionText(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/\s+/g, " ");
}

/** contextSets の要素を正規化（空文字許容） */
function normalizeContextSet(item) {
  if (!item || typeof item !== "object") return { target: "", purpose: "", expectedEffect: "" };
  return {
    target: typeof item.target === "string" ? item.target.trim() : "",
    purpose: typeof item.purpose === "string" ? item.purpose.trim() : "",
    expectedEffect: typeof item.expectedEffect === "string" ? item.expectedEffect.trim() : "",
  };
}

async function generateSharpQuestions(themeId) {
  console.log(
    `[QuestionGenerator] Starting sharp question generation for theme ${themeId}...`
  );
  try {
    // 1. Fetch problem and solution statements for this theme
    const [problems, solutions] = await Promise.all([
      Problem.find({ themeId }, "statement").lean(),
      Solution.find({ themeId }, "statement").lean(),
    ]);
    if (!problems || problems.length === 0) {
      console.log(
        `[QuestionGenerator] No problems found for theme ${themeId} to generate questions from.`
      );
      return;
    }
    const problemStatements = problems.map((p) => p.statement);
    const solutionStatements = (solutions || []).map((s) => s.statement);
    console.log(
      `[QuestionGenerator] Found ${problemStatements.length} problems, ${solutionStatements.length} solutions for theme ${themeId}.`
    );

    // 2. Prepare prompt for LLM
    const messages = [
      {
        role: "system",
        content: `You are an AI assistant that generates "How Might We..." (HMW) style questions for policy discussion, based on Design Thinking. For each question you must provide:
1. **HMW question** (問い): A short question in Japanese that states the desired future and the gap with reality. Maximum 50 characters. Use simple language (compulsory education level).
2. **tagLine** (見出し): A catchy headline for the question. Maximum 15 characters.
3. **contextSets**: An array of one or more sets. Each set has three optional fields (empty string is OK):
   - **target** (対象): Who is this for? e.g. "若年層", "高齢者", "子育て世帯"
   - **purpose** (目的): Why do we need to do this? e.g. "貧困層の支援", "防災", "新産業創出"
   - **expectedEffect** (期待効果): What happens if we do it? e.g. "雇用が安定する", "災害リスクが下がる"
   The same HMW can have multiple context sets (e.g. different targets or purposes). It is OK to leave some fields empty in a set.

Generate exactly 6 question objects. Each object must have: "question", "tagLine", "contextSets".
Output ONLY a JSON object with a single key "questions", whose value is an array of these 6 objects.
Example shape: { "questions": [ { "question": "...", "tagLine": "...", "contextSets": [ { "target": "...", "purpose": "...", "expectedEffect": "..." } ] }, ... ] }`,
      },
      {
        role: "user",
        content: `Generate 6 HMW-style questions in Japanese from the following.

【課題】
${problemStatements.join("\n- ")}

${solutionStatements.length > 0 ? `【解決策（参考）】\n${solutionStatements.join("\n- ")}\n\n` : ""}For each of the 6 questions:
- "question": In at most 50 characters, state the desired state and the gap with reality (望ましい姿と現実の差を端的に).
- "tagLine": In at most 15 characters, a clear headline.
- "contextSets": At least one set per question; multiple sets OK. Each set may have target (対象), purpose (目的), expectedEffect (期待効果). Empty strings are OK.

Respond with a JSON object: { "questions": [ ... ] }`,
      },
    ];

    // 3. Call LLM
    console.log("[QuestionGenerator] Calling LLM to generate questions...");
    let llmResponse;
    try {
      llmResponse = await callLLM(messages, true, "gpt-5-mini"); // Request JSON output with specific model
    } catch (error) {
      console.error("[QuestionGenerator] Error calling LLM:", error.message);
      throw new Error(`LLM call failed: ${error.message}`);
    }

    if (
      !llmResponse ||
      !Array.isArray(llmResponse.questions) ||
      llmResponse.questions.length === 0
    ) {
      console.error(
        "[QuestionGenerator] Failed to get valid questions array from LLM response:",
        llmResponse
      );
      throw new Error("LLM did not return valid questions array");
    }

    const generatedQuestionObjects = llmResponse.questions;
    console.log(
      `[QuestionGenerator] LLM generated ${generatedQuestionObjects.length} question objects.`
    );

    // 4. 既存問い数・正規化済み文言を取得（1テーマ最大10件・重複判定用）
    const existingQuestions = await SharpQuestion.find({ themeId })
      .select("questionText")
      .lean();
    const existingCount = existingQuestions.length;
    const normalizedExisting = new Set(
      existingQuestions.map((q) => normalizeQuestionText(q.questionText))
    );

    if (existingCount >= 10) {
      console.log(
        `[QuestionGenerator] Theme ${themeId} already has ${existingCount} questions (max 10). Skipping insert.`
      );
      return;
    }

    // 5. Save questions to DB (重複なし・最大10件まで)
    let savedCount = 0;
    for (const questionObj of generatedQuestionObjects) {
      let questionText = questionObj.question;
      let tagLine = (questionObj.tagLine || "").trim();
      const rawContextSets = Array.isArray(questionObj.contextSets)
        ? questionObj.contextSets
        : [];

      if (!questionText || typeof questionText !== "string") {
        console.warn(
          "[QuestionGenerator] Skipping invalid question object (missing or invalid text):",
          questionObj
        );
        continue;
      }

      questionText = questionText.trim();
      if (questionText.length > QUESTION_MAX_LENGTH) {
        questionText = questionText.slice(0, QUESTION_MAX_LENGTH);
      }
      if (tagLine.length > TAGLINE_MAX_LENGTH) {
        tagLine = tagLine.slice(0, TAGLINE_MAX_LENGTH);
      }

      let contextSets = rawContextSets.map(normalizeContextSet);
      if (contextSets.length === 0) {
        contextSets = [{ target: "", purpose: "", expectedEffect: "" }];
      }

      const normalized = normalizeQuestionText(questionText);

      // 正規化した文言が既存（または今回のバッチで追加済み）と重複する場合は挿入しない
      if (normalizedExisting.has(normalized)) {
        console.log(
          `[QuestionGenerator] Skipping duplicate (normalized): "${normalized.slice(0, 40)}..."`
        );
        continue;
      }

      // 1テーマあたり最大10件：既に10件に達している場合は挿入しない
      if (existingCount + savedCount >= 10) {
        console.log(
          `[QuestionGenerator] Theme ${themeId} reached 10 questions. Skipping remaining.`
        );
        continue;
      }

      try {
        // 完全一致の既存問いがあれば挿入しない
        const found = await SharpQuestion.findOne({
          questionText,
          themeId,
        });
        if (found) {
          continue;
        }

        const created = await SharpQuestion.create({
          questionText,
          tagLine,
          tags: questionObj.tags || [],
          contextSets,
          themeId,
        });

        normalizedExisting.add(normalized);
        savedCount++;
        console.log(
          `[QuestionGenerator] Triggering linking for question ID: ${created._id}`
        );
        setTimeout(() => linkQuestionToAllItems(created._id.toString()), 0);
      } catch (dbError) {
        console.error(
          `[QuestionGenerator] Error saving question "${trimmed}":`,
          dbError
        );
      }
    }

    console.log(
      `[QuestionGenerator] Successfully inserted ${savedCount} new questions for theme ${themeId} (total cap 10).`
    );
    // Linking is now triggered after each question is saved/upserted above.
  } catch (error) {
    console.error(
      "[QuestionGenerator] Error during sharp question generation:",
      error
    );
  }
}

export { generateSharpQuestions };
