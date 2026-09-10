import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config({ override: true });

let _openai = null;
function getClient() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * アプリ全体で使うモデルID。**変更するときはここだけ**を直す。
 * 呼び出し側は文字列を直書きせず、この定数を import して渡すこと。
 */
const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_MAX_TOKENS = 2048;

/**
 * 既定の思考の深さ。gpt-5.6-luna は指定しないと medium で思考し、
 * 思考トークンが出力上限（max_completion_tokens）を消費して出力料金もかかる。
 * 上限に達すると、表示される返答が空のまま終わることがある（2026-09-10 の Sonnet 5 の障害と同じ構造）。
 * 呼び出し側は extraOptions.reasoning_effort で個別に上書きできる。
 */
const DEFAULT_REASONING_EFFORT = "none";

/**
 * Call an LLM model via OpenAI Chat Completions API
 * @param {Array} messages - Array of message objects with role and content properties
 * @param {boolean} jsonOutput - Whether to request JSON output from the LLM
 * @param {string} model - The model ID to use (defaults to DEFAULT_MODEL)
 * @param {Object} extraOptions - max_tokens（出力上限。思考トークンを含む）と reasoning_effort を受け付ける
 * @returns {string|Object} - Returns parsed JSON object if jsonOutput=true, otherwise string content
 */
async function callLLM(
  messages,
  jsonOutput = false,
  model = DEFAULT_MODEL,
  extraOptions = {}
) {
  if (!process.env.OPENAI_API_KEY) {
    const message =
      "No valid API key found. Please set OPENAI_API_KEY in your environment.";
    console.error(message);
    throw new Error(message);
  }

  if (jsonOutput) {
    // json_object モードは、メッセージのどこかに "JSON" という語が含まれている必要がある
    const last = messages[messages.length - 1];
    if (last && last.role === "user") {
      last.content += "\n\nPlease respond ONLY in JSON format.";
    }
  }

  const {
    max_tokens: maxTokens = DEFAULT_MAX_TOKENS,
    reasoning_effort: reasoningEffort = DEFAULT_REASONING_EFFORT,
  } = extraOptions;

  const options = {
    model: model || DEFAULT_MODEL,
    messages,
    // 推論モデルでは max_tokens ではなく max_completion_tokens。思考トークンもこの上限に含まれる
    max_completion_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
  };
  if (jsonOutput) {
    options.response_format = { type: "json_object" };
  }

  // ログは1呼び出し1行にする。以前は system プロンプトとレスポンスJSONを丸ごと出していて、
  // 10人同時でも Railway のログ上限（500行/秒）を超えてログが欠落していた。
  // キー名（max= / msgs= / stop= / in= / out= / think= / ms=）は scripts/classStatus.mjs が読んでいる。
  const callInfo = `model=${options.model} max=${maxTokens} msgs=${messages.length} thinking=${reasoningEffort}`;
  const startedAt = Date.now();

  try {
    const response = await getClient().chat.completions.create(options);
    const choice = response.choices?.[0];
    const usage = response.usage ?? {};
    const reasoningTokens =
      usage.completion_tokens_details?.reasoning_tokens ?? 0;
    const cachedTokens = usage.prompt_tokens_details?.cached_tokens ?? 0;
    const resultInfo = `stop=${choice?.finish_reason} in=${usage.prompt_tokens} cached=${cachedTokens} out=${usage.completion_tokens} think=${reasoningTokens} ms=${Date.now() - startedAt}`;
    console.log(`[llmService] ${callInfo} ${resultInfo}`);

    const content = choice?.message?.content;

    if (!content) {
      const refusal = choice?.message?.refusal
        ? ` refusal=${choice.message.refusal}`
        : "";
      throw new Error(
        `LLM returned empty content. (${callInfo} ${resultInfo}${refusal})`
      );
    }

    // 出力が上限で打ち切られた場合を明示的に検知する。
    // これを見ないと「長すぎて切れた」と「JSONが壊れていた」がログ上で区別できない。
    if (choice.finish_reason === "length") {
      console.warn(
        `[llmService] Output was TRUNCATED by max_tokens (${maxTokens}). ` +
          `Model: ${options.model}. Increase max_tokens for this call site or shorten the requested output.`
      );
    }

    if (jsonOutput) {
      try {
        let jsonString = content;

        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          jsonString = jsonMatch[1];
        } else {
          const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
          }
        }

        return JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse LLM JSON response:", content, e);
        throw new Error(
          `LLM did not return valid JSON. Raw response: ${content}`
        );
      }
    }

    return content;
  } catch (error) {
    // スタックは呼び出し元がログに出すので、ここでは1行にとどめる
    const status = error.status ? ` status=${error.status}` : "";
    const firstLine = String(error.message).split("\n")[0].slice(0, 300);
    console.error(
      `[llmService] Error calling LLM: ${callInfo} ms=${Date.now() - startedAt}${status} ${firstLine}`
    );
    throw error;
  }
}

async function testLLM(model) {
  console.log("Testing LLM connection...");
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not found in environment variables.");
    return;
  }
  try {
    const response = await callLLM(
      [{ role: "user", content: "Hello!" }],
      false,
      model
    );
    console.log(`LLM Test Response (${model || DEFAULT_MODEL}):`);
    console.log(response);
    return response;
  } catch (error) {
    console.error("LLM Test Failed:", error);
    throw error;
  }
}

export { callLLM, testLLM, DEFAULT_MODEL };
