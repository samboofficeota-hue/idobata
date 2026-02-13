import Problem from "../models/Problem.js";
import SharpQuestion from "../models/SharpQuestion.js";
import { callLLM } from "../services/llmService.js";
import { linkQuestionToAllItems } from "./linkingWorker.js"; // Import the linking function

/** 重複判定用: 空白の正規化（trim + 連続空白を1つに）。表記ゆれで別問いとみなさないため */
function normalizeQuestionText(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/\s+/g, " ");
}

async function generateSharpQuestions(themeId) {
  console.log(
    `[QuestionGenerator] Starting sharp question generation for theme ${themeId}...`
  );
  try {
    // 1. Fetch all problem statements for this theme
    const problems = await Problem.find({ themeId }, "statement").lean();
    if (!problems || problems.length === 0) {
      console.log(
        `[QuestionGenerator] No problems found for theme ${themeId} to generate questions from.`
      );
      return;
    }
    const problemStatements = problems.map((p) => p.statement);
    console.log(
      `[QuestionGenerator] Found ${problemStatements.length} problem statements for theme ${themeId}.`
    );

    // 2. Prepare prompt for LLM
    const messages = [
      {
        role: "system",
        content: `You are an AI assistant specialized in synthesizing problem statements into insightful "How Might We..." (HMW) questions based on Design Thinking principles. Your goal is to generate concise, actionable, and thought-provoking questions that capture the essence of the underlying challenges presented in the input problem statements. Consolidate similar problems into broader HMW questions where appropriate.

For question 1-3, focus exclusively on describing both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Do NOT suggest or imply any specific means, methods, or solutions in the questions. The questions should keep the problem space open for creative solutions rather than narrowing the range of possible answers.
For question 4-6, focus on questions in the format 「現状は○○だが、それが○○になるの望ましいだろうか？」. This format is intended to question the validity or desirability of the potential future state itself, especially for points where consensus on the ideal might be lacking.

Generate all questions in Japanese language.
All generated text ("question", "tagLine", "tags") should use language easily understandable by those who has completed compulsory education in Japan.
Respond ONLY with a JSON object containing a single key: "questions".
The value of "questions" should be an array of objects. Each object in the array must contain the following keys:
1. "question": A string containing the generated question in Japanese (50-100 characters).
2. "tagLine": A string about 20 characters providing a catchy & easy-to-understand summary of the question.
3. "tags": An array of 2 strings, each being a short, simple word (2-7 characters) representing categories for the question.

Generate 6 question objects in total within the "questions" array.
`,
      },
      {
        role: "user",
        content: `Based on the following problem statements, please generate relevant questions in Japanese using the format "How Might We...":\n\n${problemStatements.join("\n- ")}\n\nFor each question, clearly describe both the current state ("現状はこう") and the desired state ("それをこうしたい") with high detail. Focus exclusively on describing these states without suggesting any specific means, methods, or solutions that could narrow the range of possible answers.\n\nPlease provide the output as a JSON object containing a "questions" array, where each element is an object with "question", "tagLine", and "tags" keys.`,
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
      const questionText = questionObj.question;
      const tagLine = questionObj.tagLine || "";
      const tags = questionObj.tags || [];

      if (!questionText || typeof questionText !== "string") {
        console.warn(
          "[QuestionGenerator] Skipping invalid question object (missing or invalid text):",
          questionObj
        );
        continue;
      }

      const trimmed = questionText.trim();
      const normalized = normalizeQuestionText(trimmed);

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
          questionText: trimmed,
          themeId,
        });
        if (found) {
          continue;
        }

        const created = await SharpQuestion.create({
          questionText: trimmed,
          tagLine,
          tags,
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
