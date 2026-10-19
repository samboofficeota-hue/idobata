import { resolveMembers } from "./personas.js";
import {
  OUTPUT_LABELS,
  STEPS,
  allowedSpeakers,
  capturableFields,
  stepTiming,
} from "./steps.js";

// AIの役割（設計ドキュメント v2 第6章）。メンバー3人の立場はお題ごとに作る（personas.js）
const FACILITATOR = {
  name: "ファシリ",
  role: "ファシリテーター",
  stance:
    "進行役。自分の意見は出さない。次に話すメンバーを1人選び、残り時間を見て進行を寄せ、工程の切り替えを伝える。メンバーの議論が先走ったら止めて、参加者に話を戻す。",
};
const EDITOR = { name: "編集者" };

// 話者の名前（会話の履歴に付ける）
const speakerName = (speaker, members) =>
  speaker === "facilitator"
    ? FACILITATOR.name
    : speaker === "editor"
      ? EDITOR.name
      : (members[speaker]?.name ?? speaker);

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
- 発言は2〜3文、120字程度まで。最後は参加者への問いを1つだけ置く（問いを重ねない）。
- 課題も解決策も、決めるのは参加者。AIが代わりに結論を出さない。
- 丁寧語で話す。参加者の考えを否定せず、問いで詰める。
- 参加者の名前は、ニックネームで呼ぶ。
- 参加者が書いた言葉を短く引いてから問う（例：「『夜は暗くて怖い』とのことですが」）。一般論で返さない。
- 参加者がすでに答えたことを聞き直さない。同じ問いを言い換えて繰り返さない。`;

// 参加者の反応ごとの応じ方。ここが弱いと、AIが同じ型の問いを繰り返すだけになる
const RESPONSES = `# 参加者の反応への応じ方
- 短い・あいまい（「はい」「いいと思う」など）：具体的な場面を1つ聞くか、選択肢を2〜3個示して選んでもらう。
- 「わからない」「特にない」：責めない。問いを小さく、答えやすくする。考える手がかりになる例を1つ示してよい。
- 長く、たくさん書いた：要点を一言で言い返して受け止めてから、一番大事そうな1点に絞って問う。
- AIに意見や情報を求めた（「どう思う？」「ほかではどうしてる？」）：はぐらかさない。メンバーが自分の立場から短く1つ答え、それを参加者がどう考えるかを問い返す。分からない事実は、分からないと言う。
- AIの指摘に反論した・納得していない：受け止めて、その理由を聞く。押し付けない。筋が通っていれば、その考えで先へ進める。
- 怒り・不安・あきらめが見える：まず気持ちを受け止める一言を入れてから問う。
- お題から外れた：受け止めてから、お題とのつながりを問う。
- 特定のメンバーに話しかけた：そのメンバーが答える。
- 先へ進みたい、時間を気にしている：ファシリテーターが、ここまでの要点をまとめて進行を寄せる。`;

const SPEAKER_GUIDE = `# 次に話す人の選び方
- 進行・まとめ・工程の切り替え・時間の管理・話が先走ったとき：facilitator
- 話が抽象的、誰が困っているのかが見えない：member1
- 案が出た、楽観的すぎる、反対する人の言い分が抜けている：member2
- 前提が固まりすぎている、課題の立て方そのものを疑いたい：member3
- メンバーは、直前の別のメンバーの発言を受けて、別の角度から重ねてもよい。`;

// 問い詰める強さ（参加者が会話の画面で選ぶ）
const INTENSITY = {
  gentle:
    "やさしく。まず共感し、参加者の考えの良いところを言葉にしてから、問いを1つ置く。反対の立場や「そもそも」の問いも、やわらかい言い方にする。",
  normal:
    "ふつう。受け止めてから、根拠や具体例を問う。必要なら弱いところをはっきり指摘する。",
  strict:
    "きびしく（grill me）。あいまいな答えはそのままにせず、根拠・具体例・反例を容赦なく問う。都合の良い前提や見落としを遠慮なく指摘する。ただし人格や言い方を責めない。",
};

const OUTPUT_FORMAT = (step) => {
  const speakers = allowedSpeakers(step).join(" | ");
  const fields = capturableFields(step);
  const captureLine = fields.length
    ? `  "capture": { ${fields.map((f) => `"${f}": "参加者が自分の言葉で確定した${OUTPUT_LABELS[f]}。まだなら空文字"`).join(", ")} },`
    : `  "capture": {},`;
  return `# 出力形式（JSONのみ）
{
  "read": "参加者の直前の発言の読み取り（何を言ったか、上のどの反応か、足りないものは何か）と、次に誰がなぜ話すか。60字以内。参加者には見せない",
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

const formatMembers = (step, members) =>
  allowedSpeakers(step)
    .map((key) => {
      const p = key === "facilitator" ? FACILITATOR : members[key];
      return `- ${key}：${p.name}（${p.role}）… ${p.stance}`;
    })
    .join("\n");

// この工程で誰が何回話したか。同じメンバーばかりにならないよう、指示文に添える
export const speakerBalance = (session, members) => {
  const step = session.step;
  const keys = allowedSpeakers(step).filter((k) => k !== "facilitator");
  if (keys.length === 0) return "";
  const inStep = (session.messages ?? []).filter(
    (m) => m.step === step && m.speaker !== "user"
  );
  const counts = keys.map(
    (k) =>
      `${members[k].name} ${inStep.filter((m) => m.speaker === k).length}回`
  );
  const last = inStep.at(-1)?.speaker;
  const silent = keys.filter((k) => !inStep.some((m) => m.speaker === k));
  const lines = [`# この工程の発言の回数\n${counts.join("、")}`];
  if (last) lines.push(`直前に話したAI：${speakerName(last, members)}`);
  if (silent.length > 0 && inStep.length >= 2) {
    lines.push(
      `まだ話していないメンバー：${silent.map((k) => members[k].name).join("、")}。話の流れに合えば、次はこの人にする。`
    );
  }
  if (step === 6 && !inStep.some((m) => m.speaker === "member3")) {
    lines.push(
      `${members.member3.name}はまだ「そもそもこの課題で合っているか」のちゃぶ台返しをしていない。アイディアが2つ以上出たら、${members.member3.name}に問わせる。`
    );
  }
  return lines.join("\n");
};

const formatStepGoals = () =>
  Object.entries(STEP_GOALS)
    .map(
      ([step, goal]) =>
        `## 工程${step}「${STEPS[step].label}」（${STEPS[step].diamond}）\n${goal}`
    )
    .join("\n\n");

const formatIntensities = () =>
  Object.entries(INTENSITY)
    .map(([key, text]) => `- ${key}：${text}`)
    .join("\n");

// 1回の発言を作るための指示文。AIが4人いても、呼び出しは1回にする
//
// 指示文は2つに分ける。OpenAI のキャッシュは、送る内容の先頭から同じ部分にしか効かないため。
//  - 先頭（buildTurnSystemPrompt）：お題・役割・ルールなど、20分のあいだ変わらないもの
//  - 末尾（buildTurnContext）：工程・残り時間・決まったこと・みんなの声など、毎回変わるもの
// 並びは「先頭 → 会話の履歴 → 末尾」。こうすると、先頭と履歴の前の部分が毎回キャッシュに乗る
export const buildTurnSystemPrompt = ({ room, session }) => {
  const members = resolveMembers(room);
  return `あなたは「いどばた会議室」で、参加者1人と擬似的なグループディスカッションをするAIたちを演じる。参加者がダブルダイヤモンドの考え方で、お題について「対象領域・課題・解決策」を一つのストーリーとして語れるようになるのを助ける。

# お題
${room.title}
${room.background ? `\n# 背景\n${room.background}\n` : ""}
# 参加者
ニックネーム：${session.nickname}

# 登場するAI
工程2は参加者とファシリテーターの1対1。工程4から、メンバー3人が加わる。
${formatMembers(4, members)}

# 工程ごとの目的
${formatStepGoals()}

${RULES}

${RESPONSES}

${SPEAKER_GUIDE}

# 問い詰める強さ（工程4〜8。どれを使うかは、会話の最後の「今の状況」で伝える）
${formatIntensities()}

# 返答のしかた
会話の最後に「今の状況」が届く。そこに書かれた工程・話してよいAI・出力形式に従って、JSONだけで返す。`;
};

// 毎回変わる情報。会話の履歴の後ろに置く
export const buildTurnContext = ({ room, session, now = new Date() }) => {
  const step = session.step;
  const members = resolveMembers(room);
  const withMembers = step >= 4;
  const timing = stepTiming(session, now);
  const timeNote =
    timing.stepRemainingSec !== null && timing.stepRemainingSec <= 0
      ? "この工程の予定時間を過ぎている。まとめに入り、次の工程へ進める。"
      : "";

  return [
    `# 今の状況
工程${step}「${STEPS[step].label}」（${STEPS[step].diamond}）。目的は「工程ごとの目的」のとおり。`,
    `# 話してよいAI
${formatMembers(step, members)}`,
    `# 残り時間
- この工程：${formatSeconds(timing.stepRemainingSec)}
- 全体（20分）：${formatSeconds(timing.totalRemainingSec)}
${timeNote}`.trim(),
    `# ここまでに決まったこと
${formatOutputs(session.outputs)}`,
    withMembers ? formatOverview(room.overview) : "",
    withMembers ? speakerBalance(session, members) : "",
    withMembers ? `# 今の強さ\n${session.intensity ?? "normal"}` : "",
    OUTPUT_FORMAT(step),
  ]
    .filter(Boolean)
    .join("\n\n");
};

// 会話の履歴。誰の発言かが分かるように名前を付ける
export const buildHistory = (messages, room) => {
  const members = resolveMembers(room);
  return messages.map((m) =>
    m.speaker === "user"
      ? { role: "user", content: m.content }
      : {
          role: "assistant",
          content: `【${speakerName(m.speaker, members)}】${m.content}`,
        }
  );
};

// 参加者のボタン操作で工程に入ったときの、最初の発言の依頼
export const enterStepInstruction = (step) =>
  step === 4
    ? "（工程4が始まった。ファシリテーターとして、メンバー3人をどんな立場の人か一言ずつ紹介し、工程2で参加者が書いたことと工程3で見たみんなの声を踏まえて、参加者が何を課題と捉えるかを最初に問う。）"
    : `（工程${step}「${STEPS[step].label}」が始まった。ファシリテーターとして、この工程で何をするかを一言で伝え、最初の問いを投げる。）`;

// 工程2の最初の一言（AIを呼ばずに定型文で始める）
export const openingMessage = (room, nickname) =>
  `${nickname}さん、よろしくお願いします。ファシリテーターのファシリです。お題は「${room.title}」です。まずは、このお題について思っていることや、これまでに見たり経験したりしたことを、自由に書いてください。うまくまとまっていなくて大丈夫です。`;
