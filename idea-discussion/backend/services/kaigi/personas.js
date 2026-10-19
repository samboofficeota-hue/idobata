import { kaigiLLM } from "./llm.js";

// AIメンバー3人の立場（設計ドキュメント v2 6.2）
// 名前と役回り（寄り添う／反対する／そもそもを問う）は固定し、
// 「どんな立場の人か」はお題ごとに背景から作る。お題1つにつき1回だけ作り、全員で使い回す

export const MEMBER_KEYS = ["member1", "member2", "member3"];

// 役回り。お題に合わせた立場を作るときの型で、作れなかったときの既定の立場でもある
export const MEMBER_ARCHETYPES = {
  member1: {
    name: "ミナミ",
    archetype: "当事者に寄り添う人",
    role: "当事者の目線",
    stance:
      "困っている人や、そこで暮らす人の実感から考える。『それで誰が助かるのか』『その人はどう感じるか』を問う。",
  },
  member2: {
    name: "ケンジ",
    archetype: "反対の立場・現実派",
    role: "反対の立場",
    stance:
      "あえて逆の見方を出す。費用・手間・前例・反対しそうな人の言い分から、案の弱いところを問う。",
  },
  member3: {
    name: "ソラ",
    archetype: "外から来た人",
    role: "外から来た人",
    stance:
      "前提を知らない立場から素朴な疑問を投げる。『そもそも』を問い、必要ならちゃぶ台を返す（課題設定そのものが合っているかを問う）。",
  },
};

const MAX_ROLE_LENGTH = 16;
const MAX_STANCE_LENGTH = 160;

export const buildPersonaMessages = (room) => [
  {
    role: "system",
    content: `あなたは話し合いの場づくりを手伝う補助役。お題と背景を読み、参加者と議論するAIメンバー3人が「どんな立場の人として話すか」を決める。

# 3人の役回り（変えない）
- member1（${MEMBER_ARCHETYPES.member1.name}）：${MEMBER_ARCHETYPES.member1.archetype}。このお題で一番影響を受ける人の実感から話す
- member2（${MEMBER_ARCHETYPES.member2.name}）：${MEMBER_ARCHETYPES.member2.archetype}。費用・手間・前例、反対しそうな人の言い分から話す
- member3（${MEMBER_ARCHETYPES.member3.name}）：${MEMBER_ARCHETYPES.member3.archetype}。事情を知らない立場から「そもそも」を問う

# ルール
- お題の場（マンション、PTA、町内会、職場など）に実際にいそうな人にする。例：「子育て中の住民」「会計を担当した元理事」「最近引っ越してきた人」
- role は肩書きのような短い言葉（${MAX_ROLE_LENGTH}字以内）。
- stance は、その人が何を大事にし、どんな問いを投げるかを2文で書く（${MAX_STANCE_LENGTH}字以内）。
- 特定の個人や団体を名指ししない。年齢・性別・国籍などで人をひとくくりにしない。
- 3人の見方が重ならないようにする。

# 出力形式（JSONのみ）
{
  "member1": { "role": "", "stance": "" },
  "member2": { "role": "", "stance": "" },
  "member3": { "role": "", "stance": "" }
}`,
  },
  {
    role: "user",
    content: `# お題\n${room.title}\n\n# 背景\n${room.background || "（なし）"}`,
  },
];

const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// AIの返答から使える立場だけを取り出す。足りなければ、そのメンバーは既定の立場を使う
export const normalizePersonas = (raw) => {
  const personas = {};
  for (const key of MEMBER_KEYS) {
    const role = clean(raw?.[key]?.role, MAX_ROLE_LENGTH);
    const stance = clean(raw?.[key]?.stance, MAX_STANCE_LENGTH);
    if (role && stance) personas[key] = { role, stance };
  }
  return personas;
};

// お題の立場と既定の立場を合わせた、3人分の立場
export const resolveMembers = (room) =>
  Object.fromEntries(
    MEMBER_KEYS.map((key) => {
      const base = MEMBER_ARCHETYPES[key];
      const custom = room?.personas?.[key];
      return [
        key,
        {
          name: base.name,
          archetype: base.archetype,
          role: custom?.role || base.role,
          stance: custom?.stance || base.stance,
        },
      ];
    })
  );

const hasPersonas = (room) =>
  MEMBER_KEYS.some((key) => room?.personas?.[key]?.role);

// 同じお題で同時に作らないようにする
const inflight = new Map();

// お題の立場を用意する。作れなかったときは既定の立場のまま進める（エラーにしない）
export const ensurePersonas = async (room) => {
  if (hasPersonas(room)) return room.personas;
  const key = room._id.toString();
  if (inflight.has(key)) {
    // 別の読み込みで作っている最中なら、できたものをこのお題の手元にも写す
    const personas = await inflight.get(key);
    if (personas && !hasPersonas(room)) room.set("personas", personas);
    return room.personas;
  }

  const job = (async () => {
    try {
      const raw = await kaigiLLM(buildPersonaMessages(room), {
        maxTokens: 600,
      });
      const personas = normalizePersonas(raw);
      if (Object.keys(personas).length > 0) {
        room.personas = personas;
        await room.save();
      }
    } catch (error) {
      console.error(`[kaigi/personas] failed room=${room._id}:`, error.message);
    }
    return room.personas;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
};
