// いどばた会議室の10工程（設計ドキュメント v2 第5章）
// 時間は打ち込み開始（工程2）からの経過分。叩き台の配分で、実測して直す前提

export const SESSION_MINUTES = 20;

export const STEPS = {
  1: { label: "お題", diamond: "", chat: false, endsAtMin: 0 },
  2: { label: "思いを書き出す", diamond: "左・発散", chat: true, endsAtMin: 5 },
  3: {
    label: "みんなの声を見る",
    diamond: "左・頂点",
    chat: false,
    endsAtMin: 6,
  },
  4: { label: "課題を絞る", diamond: "左・収束", chat: true, endsAtMin: 9 },
  5: {
    label: "課題を言葉にする",
    diamond: "左・終点",
    chat: true,
    endsAtMin: 10,
  },
  6: {
    label: "アイディアを広げる",
    diamond: "右・発散",
    chat: true,
    endsAtMin: 13,
  },
  7: { label: "行ったり来たり", diamond: "左右", chat: true, endsAtMin: 15 },
  8: { label: "決める", diamond: "右・収束", chat: true, endsAtMin: 17 },
  9: { label: "ストーリーにする", diamond: "", chat: false, endsAtMin: 19 },
  10: { label: "スライドにする", diamond: "", chat: false, endsAtMin: 20 },
};

export const FIRST_STEP = 1;
export const LAST_STEP = 10;

export const isChatStep = (step) => Boolean(STEPS[step]?.chat);

// 工程2は参加者とファシリテーターの1対1。工程4〜8はAIメンバー3人が加わる
export const allowedSpeakers = (step) =>
  step === 2
    ? ["facilitator"]
    : ["facilitator", "member1", "member2", "member3"];

// AIがその工程で書き留めてよい項目（黄色の3点）
const CAPTURABLE = {
  4: ["issue"],
  5: ["issue"],
  6: ["issue"],
  7: ["issue", "solution"],
  8: ["issue", "solution", "domain"],
};
export const capturableFields = (step) => CAPTURABLE[step] ?? [];

// その工程を出るときにそろっていなければならない項目
const REQUIRED_TO_LEAVE = {
  5: ["issue"],
  6: ["issue"],
  7: ["issue"],
  8: ["domain", "issue", "solution"],
};

export const OUTPUT_LABELS = {
  domain: "対象領域",
  issue: "課題",
  solution: "解決策",
};

export const missingToLeave = (step, outputs = {}) =>
  (REQUIRED_TO_LEAVE[step] ?? []).filter(
    (key) => !String(outputs[key] ?? "").trim()
  );

// AIの判断で次の工程へ進めてよいか。工程8から先は参加者が自分で確定させる
export const canAiAdvance = (step) => step >= 2 && step <= 7 && step !== 3;

export const nextStep = (step) => Math.min(step + 1, LAST_STEP);

// 残り時間（秒）。工程ごとの締めは、開始時刻からの通しの予定で計算する
export const stepTiming = (session, now = new Date()) => {
  if (!session.startedAt) {
    return {
      totalRemainingSec: SESSION_MINUTES * 60,
      stepRemainingSec: null,
      overtime: false,
    };
  }
  const elapsedSec =
    (now.getTime() - new Date(session.startedAt).getTime()) / 1000;
  const totalRemainingSec = Math.round(SESSION_MINUTES * 60 - elapsedSec);
  const endsAtMin = STEPS[session.step]?.endsAtMin;
  const stepRemainingSec =
    typeof endsAtMin === "number" && session.step >= 2
      ? Math.round(endsAtMin * 60 - elapsedSec)
      : null;
  return {
    totalRemainingSec,
    stepRemainingSec,
    overtime: totalRemainingSec < 0,
  };
};
