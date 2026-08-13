import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ override: true });

let _anthropic = null;
function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * アプリ全体で使うモデルID。**変更するときはここだけ**を直す。
 * 呼び出し側は文字列を直書きせず、この定数を import して渡すこと。
 */
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 2048;

/**
 * Call an LLM model via Anthropic API
 * @param {Array} messages - Array of message objects with role and content properties
 * @param {boolean} jsonOutput - Whether to request JSON output from the LLM
 * @param {string} model - The model ID to use (defaults to DEFAULT_MODEL)
 * @param {Object} extraOptions - Additional API options (e.g. max_tokens)
 * @returns {string|Object} - Returns parsed JSON object if jsonOutput=true, otherwise string content
 */
async function callLLM(messages, jsonOutput = false, model = DEFAULT_MODEL, extraOptions = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const message = "No valid API key found. Please set ANTHROPIC_API_KEY in your environment.";
    console.error(message);
    throw new Error(message);
  }

  // Anthropic requires system messages to be passed separately
  const systemMessages = messages.filter((m) => m.role === "system");
  const userAssistantMessages = messages.filter((m) => m.role !== "system");

  const systemPrompt = systemMessages.map((m) => m.content).join("\n");

  if (jsonOutput) {
    const last = userAssistantMessages[userAssistantMessages.length - 1];
    if (last && last.role === "user") {
      last.content += "\n\nPlease respond ONLY in JSON format.";
    }
  }

  const options = {
    model: model || DEFAULT_MODEL,
    max_tokens: extraOptions.max_tokens ?? DEFAULT_MAX_TOKENS,
    messages: userAssistantMessages,
  };

  if (systemPrompt) {
    options.system = systemPrompt;
  }

  // Spread remaining extraOptions (excluding max_tokens which is already set)
  const { max_tokens: _ignored, ...restExtra } = extraOptions;
  Object.assign(options, restExtra);

  console.log("Calling LLM with options:", JSON.stringify({ ...options, messages: `[${options.messages.length} messages]` }, null, 2));

  try {
    const response = await getClient().messages.create(options);
    console.log("LLM Response:", JSON.stringify(response, null, 2));

    const content = response.content[0]?.text;

    if (!content) {
      console.error("LLM returned empty content.");
      throw new Error("LLM returned empty content.");
    }

    // 出力が max_tokens で打ち切られた場合を明示的に検知する。
    // これを見ないと「長すぎて切れた」と「JSONが壊れていた」がログ上で区別できない。
    if (response.stop_reason === "max_tokens") {
      console.warn(
        `[llmService] Output was TRUNCATED by max_tokens (${options.max_tokens}). ` +
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
        throw new Error(`LLM did not return valid JSON. Raw response: ${content}`);
      }
    }

    return content;
  } catch (error) {
    console.error("Error calling Anthropic:", error);
    throw error;
  }
}

async function testLLM(model) {
  console.log("Testing LLM connection...");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not found in environment variables.");
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
