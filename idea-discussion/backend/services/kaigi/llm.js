import pLimit from "p-limit";
import { callLLM } from "../llmService.js";

// 会議室からAIへの同時の問い合わせ数の上限。超えた分はエラーにせず順番待ちにする
// （OpenAIの利用枠はいどばた本体と共有しているため）
const limit = pLimit(Number(process.env.KAIGI_LLM_CONCURRENCY) || 20);

// 対話は短い返答なので、思考を切って出力上限を小さく保つ（上限は利用枠から先取りされる）
export const kaigiLLM = (messages, { maxTokens = 500, json = true } = {}) =>
  limit(() =>
    callLLM(messages, json, undefined, {
      max_tokens: maxTokens,
      reasoning_effort: "none",
    })
  );
