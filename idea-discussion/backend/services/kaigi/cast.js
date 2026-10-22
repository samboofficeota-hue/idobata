import VoiceProfile from "../../models/VoiceProfile.js";
import { kaigiLLM } from "./llm.js";
import { LEAN_LABELS, MEMBERS, MEMBER_KEYS } from "./personas.js";

// お題ごとの、3体の経験・感情と、軸ごとの最初の判断（docs/いどばた会議室_キャラと論点カード.md 2章）
// - 芯（譲れないこと・大切にしたいこと）は personas.js で固定。ここではお題に合わせた部分だけを作る
// - 経験は、いどばたの実際の声のうち「自分の経験」に基づく声の理由をもとに作る（実在の人の話としては語らせない）
// - 判断は、賛成・反対・決めかねるが混ざる。軸が2つ以上あれば、傾きの側が一番多く、少なくとも1つは別の側
// - お題1つにつき1回作り、軸カードが作り直されたら作り直す。参加者が工程4に入った時点のものを固定する

export const SIDES = ["affirmative", "negative", "undecided"];

const MAX_EXPERIENCES = 2;
const MAX_SOURCE_VOICES = 30;

const clip = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// 経験の材料：紐づいたテーマの、自分の経験に基づく声（理由が書かれたもの）
export const loadExperienceVoices = async (themeId) => {
  if (!themeId) return [];
  return VoiceProfile.find({
    themeId,
    evidence: "experience",
    reason: { $ne: "" },
  })
    .select("reason values")
    .sort({ profiledAt: -1 })
    .limit(MAX_SOURCE_VOICES)
    .lean();
};

export const buildCastMessages = (room, axes, voices) => [
  {
    role: "system",
    content: `あなたは話し合いの場づくりを手伝う補助役。会議のお題について、AIメンバー3体それぞれの「経験と感情」と、論点ごとの「最初の判断」を作る。

# 3体の芯（変えない）
${MEMBER_KEYS.map(
  (k) =>
    `- ${k}（${MEMBERS[k].name}）：全体として「${LEAN_LABELS[MEMBERS[k].lean]}」に傾く。譲れないこと「${MEMBERS[k].nonNegotiable}」、大切にしたいこと「${MEMBERS[k].values.join("、")}」`
).join("\n")}

# 経験と感情の作り方
- 1体につき1〜${MAX_EXPERIENCES}個。その体の譲れないこと・大切にしたいことを形づくった、お題に関係する具体的な出来事にする。
- 材料の「実際の声の理由」から、その体の大切にしたいことに合うものを選び、ありそうな出来事として書き直す。材料がなければ、お題と背景から作る。
- 実際の声をそのまま写さない。個人を特定できることは書かない。
- episode：出来事（100字以内）。emotion：そのときの気持ち（40字以内。例：心細さ、徒労感、助けられた安堵）。

# 最初の判断の作り方
- 論点ごとに、affirmative（賛成）・negative（反対）・undecided（決めかねる）のどれか。理由（because）は、芯と経験から1文で。
- 人の中では賛成・反対・決めかねるが混ざる。全部の論点で同じ判断にしない。
- 論点が2つ以上あるときは、その体の傾きの判断が一番多くなるようにし、少なくとも1つは別の判断にする。

# 出力形式（JSONのみ）
{ "member1": { "experiences": [ { "episode": "", "emotion": "" } ], "judgments": { "R1": { "side": "affirmative", "because": "" } } }, "member2": {}, "member3": {} }`,
  },
  {
    role: "user",
    content: `# お題
${room.title}

# 背景
${room.background || "（なし）"}

# 論点
${axes.length ? axes.map((a) => `- ${a.key}：${a.proposition}（賛成：${a.affirmative}／反対：${a.negative}）`).join("\n") : "（まだない。judgments は空にする）"}

# 材料：実際の声の理由（自分の経験に基づくもの）
${voices.length ? voices.map((v) => `- ${v.reason}${v.values?.length ? `（大事にしていること：${v.values.join("、")}）` : ""}`).join("\n") : "（なし）"}`,
  },
];

// 傾きの判断が一番多く、少なくとも1つは別の判断になるよう直す（軸が2つ以上のとき）
// 直した軸は理由を空にする（AIが芯と経験から話す）
export const enforceMix = (judgments, axisKeys, lean) => {
  if (axisKeys.length < 2) return judgments;
  const result = { ...judgments };
  const count = (side) =>
    axisKeys.filter((k) => result[k].side === side).length;
  const others = SIDES.filter((s) => s !== lean);

  if (count(lean) === axisKeys.length) {
    const last = axisKeys.at(-1);
    result[last] = {
      side: lean === "undecided" ? "affirmative" : "undecided",
      because: "",
    };
  }
  for (const key of axisKeys) {
    if (others.every((s) => count(lean) >= count(s))) break;
    if (result[key].side !== lean && count(result[key].side) > count(lean)) {
      result[key] = { side: lean, because: "" };
    }
  }
  return result;
};

export const normalizeCast = (raw, axes) => {
  const axisKeys = axes.map((a) => a.key);
  return Object.fromEntries(
    MEMBER_KEYS.map((key) => {
      const r = raw?.[key] ?? {};
      const experiences = (Array.isArray(r.experiences) ? r.experiences : [])
        .map((e) => ({
          episode: clip(e?.episode, 100),
          emotion: clip(e?.emotion, 40),
        }))
        .filter((e) => e.episode)
        .slice(0, MAX_EXPERIENCES);
      const judgments = Object.fromEntries(
        axisKeys.map((axis) => {
          const j = r.judgments?.[axis];
          return SIDES.includes(j?.side)
            ? [axis, { side: j.side, because: clip(j.because, 100) }]
            : [axis, { side: MEMBERS[key].lean, because: "" }];
        })
      );
      return [
        key,
        {
          experiences,
          judgments: enforceMix(judgments, axisKeys, MEMBERS[key].lean),
        },
      ];
    })
  );
};

// 同じお題で同時に作らないようにする
const inflight = new Map();

// 軸カードに合わせて、3体の経験と最初の判断を用意する。失敗しても止めない（芯だけで話す）
export const ensureCast = async (room, now = new Date()) => {
  const axesBuiltAt = room.axes?.builtAt ?? null;
  const current = room.cast;
  if (
    current?.builtAt &&
    String(current.axesBuiltAt ?? null) === String(axesBuiltAt)
  ) {
    return current;
  }
  const key = room._id.toString();
  if (inflight.has(key)) {
    await inflight.get(key);
    const fresh = await room.constructor
      .findById(room._id)
      .select("cast")
      .lean();
    if (fresh?.cast) room.set("cast", fresh.cast);
    return room.cast;
  }
  const job = (async () => {
    try {
      const axes = room.axes?.items ?? [];
      const voices = await loadExperienceVoices(room.themeLink?.themeId);
      const raw = await kaigiLLM(buildCastMessages(room, axes, voices), {
        maxTokens: 1500,
      });
      room.cast = {
        axesBuiltAt,
        builtAt: now,
        members: normalizeCast(raw, axes),
      };
      await room.save();
    } catch (error) {
      console.error(`[kaigi/cast] failed room=${room._id}:`, error.message);
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  await job;
  return room.cast;
};
