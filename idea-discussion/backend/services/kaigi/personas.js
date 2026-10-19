import { kaigiLLM } from "./llm.js";

// AIメンバー3体（docs/いどばた会議室_キャラと論点カード.md）
// 肯定派・否定派・未定派で固定。名前と役割は変えず、お題に合わせて変えるのは肩書きだけ
// 3体は論点（対立軸）に対して立つ。テーマの3軸ができるまでは、工程3の「みんなの声の整理」の対立点を仮の軸にする

export const MEMBER_KEYS = ["member1", "member2", "member3"];

export const MEMBERS = {
  member1: {
    name: "ミナミ",
    camp: "肯定派",
    position: "軸の肯定側",
    purpose:
      "参加者の考えを、人に通じる強さまで育てる。肯定側の理由・経験・声で後押しする。",
    materials:
      "肯定側の声（理由・経験）、その案が答えている課題、みんなの声の合意点",
    questions: [
      "それで誰が、どう助かりますか？",
      "その経験を、もう少し具体的に教えてください。",
      "その理由で、反対する人を説得できそうですか？",
    ],
    tone: "温かく、受け止めてから問う。丁寧語。",
    never: "根拠のない褒め言葉を言わない。参加者の代わりに案を作らない。",
  },
  member2: {
    name: "ケンジ",
    camp: "否定派",
    position: "軸の否定側",
    purpose:
      "参加者の考えの弱いところを、本番の前に見つける。否定側の理由・懸念・声で突く。",
    materials:
      "否定側の声、懸念、当事者や別の立場の声、費用・手間・前例などの制約",
    questions: [
      "それに反対する人は、何と言うと思いますか？",
      "お金と手間は、誰が持ちますか？",
      "それで困る人はいませんか？",
    ],
    tone: "率直に、短く。丁寧語。",
    never: "人格や言い方を責めない。代案を押しつけない。",
  },
  member3: {
    name: "ソラ",
    camp: "未定派",
    position: "合意を足場に、決めきれないところ",
    purpose:
      "両方に一理あると感じて本当に迷っている、その場の一員として話す。「私はまだ決められないんですが…」と自分の迷いを出し、参加者が「そもそも何を決めるのか」を見失わないようにする。",
    materials:
      "合意点、決めきれない理由（判断に足りない情報）、まだどの案も答えていない課題",
    questions: [
      "みんなが同意しているのは〇〇ですよね。そこから考えると、どうでしょう？",
      "それを決めるのに、何が分かれば決められますか？",
      "そもそも、決めたいのはどちらのことでしょう？",
    ],
    tone: "素朴に、迷いを隠さずに。丁寧語。",
    never: "どちらかの側に立たない。自分の結論を出さない。",
  },
};

// 1体の役割を、指示文用の文章にする（肩書きはお題ごと）
export const describeMember = (key, member) =>
  `- ${key}：${member.name}（${member.label}）
  - 立つところ：${member.position}
  - 目的：${member.purpose}
  - 主に使う材料：${member.materials}
  - 得意な問い：${member.questions.map((q) => `「${q}」`).join(" ")}
  - 口調：${member.tone}
  - しないこと：${member.never}`;

const MAX_TITLE_LENGTH = 16;

export const buildPersonaMessages = (room) => [
  {
    role: "system",
    content: `あなたは話し合いの場づくりを手伝う補助役。お題と背景を読み、参加者と議論するAIメンバー3体に、お題の場に合う「肩書き」を付ける。役割は変えない。

# 3体の役割（変えない）
- member1（${MEMBERS.member1.name}）：${MEMBERS.member1.camp}。論点の肯定側に立つ
- member2（${MEMBERS.member2.name}）：${MEMBERS.member2.camp}。論点の否定側に立つ。費用・手間・反対する人の言い分から話す
- member3（${MEMBERS.member3.name}）：${MEMBERS.member3.camp}。両方に一理あると感じて迷っている、その場の一員

# ルール
- お題の場（マンション、PTA、町内会、職場など）に実際にいそうな人の肩書きにする。例：「子育て中の住民」「会計を担当した元理事」「最近引っ越してきた住民」
- 肩書きは${MAX_TITLE_LENGTH}字以内。
- 特定の個人や団体を名指ししない。年齢・性別・国籍などで人をひとくくりにしない。
- 3体の肩書きが重ならないようにする。

# 出力形式（JSONのみ）
{ "member1": "", "member2": "", "member3": "" }`,
  },
  {
    role: "user",
    content: `# お題\n${room.title}\n\n# 背景\n${room.background || "（なし）"}`,
  },
];

const clean = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// AIの返答から使える肩書きだけを取り出す。足りなければ、そのメンバーは肩書きなし
export const normalizePersonas = (raw) => {
  const personas = {};
  for (const key of MEMBER_KEYS) {
    const title = clean(raw?.[key], MAX_TITLE_LENGTH);
    if (title) personas[key] = { title };
  }
  return personas;
};

// 3体の役割に、お題の肩書きを合わせたもの
// label は画面と指示文に出す呼び名（例：否定派・管理費を預かる理事）
export const resolveMembers = (room) =>
  Object.fromEntries(
    MEMBER_KEYS.map((key) => {
      const base = MEMBERS[key];
      const title = room?.personas?.[key]?.title || "";
      return [
        key,
        {
          ...base,
          title,
          label: title ? `${base.camp}・${title}` : base.camp,
        },
      ];
    })
  );

const hasPersonas = (room) =>
  MEMBER_KEYS.some((key) => room?.personas?.[key]?.title);

// 同じお題で同時に作らないようにする
const inflight = new Map();

// お題の肩書きを用意する。作れなかったときは肩書きなしで進める（エラーにしない）
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
        maxTokens: 300,
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
