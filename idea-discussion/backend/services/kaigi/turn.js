import { kaigiLLM } from "./llm.js";
import {
  buildHistory,
  buildTurnSystemPrompt,
  enterStepInstruction,
} from "./prompts.js";
import {
  allowedSpeakers,
  canAiAdvance,
  capturableFields,
  missingToLeave,
  nextStep,
} from "./steps.js";

const MAX_CAPTURE_LENGTH = 300;
const FALLBACK_CONTENT =
  "すみません、うまく聞き取れませんでした。もう一度、言い方を変えて書いてもらえますか。";

// AIの返答を、その工程で許される形に整える（話者・書き留める項目・進行）
export const normalizeTurn = (raw, step) => {
  const speakers = allowedSpeakers(step);
  const speaker = speakers.includes(raw?.speaker) ? raw.speaker : "facilitator";
  const content =
    typeof raw?.content === "string" && raw.content.trim()
      ? raw.content.trim()
      : FALLBACK_CONTENT;

  const capture = {};
  for (const key of capturableFields(step)) {
    const value = raw?.capture?.[key];
    if (typeof value === "string" && value.trim()) {
      capture[key] = value.trim().slice(0, MAX_CAPTURE_LENGTH);
    }
  }

  return { speaker, content, capture, advance: raw?.advance === true };
};

// 整えた返答をセッションに反映する。AIが進行を求めても、条件を満たさなければ進めない
export const applyTurn = (session, turn, now = new Date()) => {
  const step = session.step;
  session.messages.push({
    speaker: turn.speaker,
    content: turn.content,
    step,
    createdAt: now,
  });
  for (const [key, value] of Object.entries(turn.capture)) {
    session.outputs[key] = value;
  }

  const advanced =
    turn.advance &&
    canAiAdvance(step) &&
    missingToLeave(step, session.outputs).length === 0;
  if (advanced) {
    session.step = nextStep(step);
    session.stepStartedAt = now;
  }
  return { advanced };
};

const buildMessages = (room, session, { event, now }) => {
  const messages = [
    { role: "system", content: buildTurnSystemPrompt({ room, session, now }) },
    ...buildHistory(session.messages, room),
  ];
  if (event === "enter") {
    messages.push({
      role: "system",
      content: enterStepInstruction(session.step),
    });
  }
  return messages;
};

// 1回分の発言を作ってセッションに反映する（AIの呼び出しは1回）
// event: "reply"（参加者の発言への返答）| "enter"（ボタン操作で工程に入った直後）
export const runTurn = async (
  room,
  session,
  { event = "reply", now = new Date() } = {}
) => {
  // 発言の前に読み取り（read）を書かせるぶん、上限を少し広げている
  const raw = await kaigiLLM(buildMessages(room, session, { event, now }), {
    maxTokens: 600,
  });
  const turn = normalizeTurn(raw, session.step);
  // ボタン操作で入った直後の発言では、工程を進めない
  if (event === "enter") turn.advance = false;
  return applyTurn(session, turn, now);
};
