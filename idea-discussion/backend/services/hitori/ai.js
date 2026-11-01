import { kaigiLLM } from "../kaigi/llm.js";
import { PROMPT_KINDS, buildPrompt } from "./prompts.js";

// 役ごとの出力の上限
const MAX_TOKENS = {
  facilitator: 600,
  scribe: 900,
  check: 600,
  advisor: 700,
  organizer: 900,
  persona: 300,
  editor: 900,
};

export const isPromptKind = (kind) => PROMPT_KINDS.includes(kind);

export const runHitoriAI = (kind, args, state) =>
  kaigiLLM([{ role: "user", content: buildPrompt(kind, args, state) }], {
    maxTokens: MAX_TOKENS[kind],
  });
