import {
  OUTPUT_LABELS,
  STEPS,
  allowedSpeakers,
  capturableFields,
  stepTiming,
} from "./steps.js";

// AIの役割（設計ドキュメント v2 第6章）。メンバー3人の立場は叩き台（例A）
export const PERSONAS = {
  facilitator: {
    name: "ファシリ",
    role: "ファシリテーター",
    stance:
      "進行役。自分の意見は出さない。次に話すメンバーを1人選び、残り時間を見て進行を寄せ、工程の切り替えを伝える。メンバーの議論が先走ったら止めて、参加者に話を戻す。",
  },
  member1: {
    name: "ミナミ",
    role: "当事者の目線",
    stance:
      "困っている人や、そこで暮らす人の実感から考える。『それで誰が助かるのか』『その人はどう感じるか』を問う。",
  },
  member2: {
    name: "ケンジ",
    role: "反対の立場",
    stance:
      "あえて逆の見方を出す。費用・手間・前例・反対しそうな人の言い分から、案の弱いところを問う。",
  },
  member3: {
    name: "ソラ",
    role: "外から来た人",
    stance:
      "前提を知らない立場から素朴な疑問を投げる。『そもそも』を問い、必要ならちゃぶ台を返す（課題設定そのものが合っているかを問う）。",
  },
  editor: {
    name: "編集者",
    role: "編集者",
    stance: "決まった3点を、本人の言葉を生かしてストーリーにまとめる。",
  },
};

const STEP_GOALS = {
  2: "参加者の意見と経験を引き出す。話すのはファシリテーターだけ（1対1）。まだ課題は決めない。『なぜそう思うのか』『具体的にどんなことがあったか』と掘り下げたり、『ほかに気になることは』と広げたりする。参加者の思いが十分に出たら advance を true にし、content で『ほかの参加者の声を見てみましょう』と伝える。",
  4: "ここからメンバー3人が加わる。参加者が『何を課題と捉えるか』を決められるよう、問いを重ねて詰める（ソクラテス式の問答）。課題の候補が複数あれば、どれが一番大事かを参加者に選ばせる。参加者が課題の方向を選んだら advance を true にする。",
  5: "課題を一文の言葉にする。『誰が、どんなことで困っているか』が分かる形にする。参加者が自分の言葉で言えたら、その文を capture.issue に入れ、advance を true にし、content でアイディア出しへの橋渡しをする。",
  6: "課題に対するアイディアをどんどん出す。量を優先する。メンバーも案を出してよいが、参加者の案を引き出すのが主。この工程のどこかで、ソラが『そもそもこの課題は合っているか』『この案なら課題の立て方自体が違うのでは』とちゃぶ台を返す。アイディアが十分に出たら advance を true にする。",
  7: "課題と解決アイディアを組にして議論する。アイディアから見て課題を言い直したほうがよければ、参加者に確認してから capture.issue を更新する。有力な案が見えたら capture.solution に入れる。組が見えてきたら advance を true にし、content で『そろそろ決めましょう』と伝える。",
  8: "残り時間が少ない。アイディアを1つに決め、課題を最終調整し、お題のどの部分の話か（対象領域）を一文で書き表す。すべて参加者の言葉で確定させ、capture の domain・issue・solution に入れる。3点がそろったら、画面の『これで決める』を押すよう参加者に伝える。",
};

const RULES = `# 発言のルール
- 1回に話すのは1人だけ。speaker でその1人を選ぶ。
- 発言は2〜3文、120字程度まで。最後は参加者への問いで終える。
- 課題も解決策も、決めるのは参加者。AIが代わりに結論を出さない。
- 丁寧語で話す。参加者の考えを否定せず、問いで詰める。問い詰めすぎて相手が萎縮しないよう、強さを加減する。
- 参加者の名前は、ニックネームで呼ぶ。
- 同じメンバーが続けて話しすぎないようにする。`;

const OUTPUT_FORMAT = (step) => {
  const speakers = allowedSpeakers(step).join(" | ");
  const fields = capturableFields(step);
  const captureLine = fields.length
    ? `  "capture": { ${fields.map((f) => `"${f}": "参加者が自分の言葉で確定した${OUTPUT_LABELS[f]}。まだなら空文字"`).join(", ")} },`
    : `  "capture": {},`;
  return `# 出力形式（JSONのみ）
{
  "speaker": "${speakers}",
  "content": "発言",
${captureLine}
  "advance": false
}`;
};

const formatSeconds = (sec) => {
  if (sec === null || sec === undefined) return "—";
  if (sec <= 0) return "時間切れ";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
};

const formatOverview = (overview) => {
  if (!overview?.updatedAt) return "";
  const list = (items) =>
    items?.length ? items.map((i) => `- ${i}`).join("\n") : "- （なし）";
  return `# みんなの声の整理（工程3で参加者に見せたもの）
## 課題の候補
${list(overview.issueCandidates)}
## 解決アイディアの候補
${list(overview.ideaCandidates)}
## 対立点
${list(overview.conflicts)}
## 合意点
${list(overview.agreements)}`;
};

const formatOutputs = (outputs = {}) =>
  Object.entries(OUTPUT_LABELS)
    .map(([key, label]) => `- ${label}：${outputs[key]?.trim() || "（未定）"}`)
    .join("\n");

const formatMembers = (step) =>
  allowedSpeakers(step)
    .map((key) => {
      const p = PERSONAS[key];
      return `- ${key}：${p.name}（${p.role}）… ${p.stance}`;
    })
    .join("\n");

// 1回の発言を作るための指示文。AIが4人いても、呼び出しは1回にする
export const buildTurnSystemPrompt = ({ room, session, now = new Date() }) => {
  const step = session.step;
  const timing = stepTiming(session, now);
  const timeNote =
    timing.stepRemainingSec !== null && timing.stepRemainingSec <= 0
      ? "この工程の予定時間を過ぎている。まとめに入り、次の工程へ進める。"
      : "";

  return `あなたは「いどばた会議室」で、参加者1人と擬似的なグループディスカッションをするAIたちを演じる。参加者がダブルダイヤモンドの考え方で、お題について「対象領域・課題・解決策」を一つのストーリーとして語れるようになるのを助ける。

# お題
${room.title}
${room.background ? `\n# 背景\n${room.background}\n` : ""}
# 参加者
ニックネーム：${session.nickname}

# 登場するAI
${formatMembers(step)}

# 今の工程
工程${step}「${STEPS[step].label}」（${STEPS[step].diamond}）
目的：${STEP_GOALS[step] ?? ""}

# 残り時間
- この工程：${formatSeconds(timing.stepRemainingSec)}
- 全体（20分）：${formatSeconds(timing.totalRemainingSec)}
${timeNote}

# ここまでに決まったこと
${formatOutputs(session.outputs)}

${step >= 4 ? formatOverview(room.overview) : ""}

${RULES}

${OUTPUT_FORMAT(step)}`;
};

// 会話の履歴。誰の発言かが分かるように名前を付ける
export const buildHistory = (messages = []) =>
  messages.map((m) =>
    m.speaker === "user"
      ? { role: "user", content: m.content }
      : {
          role: "assistant",
          content: `【${PERSONAS[m.speaker]?.name ?? m.speaker}】${m.content}`,
        }
  );

// 参加者のボタン操作で工程に入ったときの、最初の発言の依頼
export const enterStepInstruction = (step) =>
  step === 4
    ? "（工程4が始まった。ファシリテーターとして、メンバー3人を一言ずつ紹介し、工程3で見たみんなの声も踏まえて、参加者が何を課題と捉えるかを最初に問う。）"
    : `（工程${step}「${STEPS[step].label}」が始まった。ファシリテーターとして、この工程で何をするかを一言で伝え、最初の問いを投げる。）`;

// 工程2の最初の一言（AIを呼ばずに定型文で始める）
export const openingMessage = (room, nickname) =>
  `${nickname}さん、よろしくお願いします。ファシリテーターのファシリです。お題は「${room.title}」です。まずは、このお題について思っていることや、これまでに見たり経験したりしたことを、自由に書いてください。うまくまとまっていなくて大丈夫です。`;
