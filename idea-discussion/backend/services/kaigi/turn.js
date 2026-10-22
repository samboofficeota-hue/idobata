import { SIDES } from "./cast.js";
import { kaigiLLM } from "./llm.js";
import {
  buildHistory,
  buildSessionBlock,
  buildTurnContext,
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

  // 話しているメンバーの判断が、新しい情報で変わったとき（形だけ整える。中身は applyTurn で確かめる）
  const j = raw?.judgment;
  const judgment =
    j && typeof j === "object"
      ? {
          axis: typeof j.axis === "string" ? j.axis : "",
          to: typeof j.to === "string" ? j.to : "",
          because:
            typeof j.because === "string" ? j.because.trim().slice(0, 100) : "",
        }
      : null;

  return {
    speaker,
    content,
    capture,
    advance: raw?.advance === true,
    judgment,
  };
};

// 判断の変化を反映する。話しているメンバーの、今ある軸の判断で、理由があり、実際に変わるときだけ
// 価値観（譲れないこと・大切にしたいこと）は変わらないので、ここで扱うのは軸ごとの判断だけ
export const applyJudgment = (session, speaker, judgment, now = new Date()) => {
  const current = session.judgments?.[speaker];
  if (!judgment || !current) return null;
  const { axis, to, because } = judgment;
  const from = current[axis];
  if (!from || !SIDES.includes(to) || to === from || !because) return null;
  session.judgments = {
    ...session.judgments,
    [speaker]: { ...current, [axis]: to },
  };
  session.markModified?.("judgments");
  const entry = {
    member: speaker,
    axis,
    from,
    to,
    because,
    step: session.step,
    at: now,
  };
  session.judgmentLog = [...(session.judgmentLog ?? []), entry];
  return entry;
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
  applyJudgment(session, turn.speaker, turn.judgment, now);

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

// 変わらない指示文 →（あれば）固定した論点 → 会話の履歴 → 毎回変わる情報、の順に並べる（キャッシュを効かせるため。prompts.js）
export const buildMessages = (room, session, { event, now }) => {
  const axesBlock = buildSessionBlock(session, room);
  const messages = [
    { role: "system", content: buildTurnSystemPrompt({ room, session }) },
    // 論点は参加者ごとに20分のあいだ固定なので、履歴の前に置いてもキャッシュは切れない
    ...(axesBlock ? [{ role: "system", content: axesBlock }] : []),
    ...buildHistory(session.messages, room),
    { role: "system", content: buildTurnContext({ room, session, now }) },
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
