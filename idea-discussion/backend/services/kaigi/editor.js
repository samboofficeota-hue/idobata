import { kaigiLLM } from "./llm.js";
import { OUTPUT_LABELS } from "./steps.js";

// 編集者AI：決まった3点を、本人の言葉を生かして1つのストーリーにし、1枚のスライドにまとめる

const MAX_USER_WORDS = 3000;

const userWords = (session) =>
  session.messages
    .filter((m) => m.speaker === "user")
    .map((m) => `- ${m.content}`)
    .join("\n")
    .slice(-MAX_USER_WORDS);

const threePoints = (outputs) =>
  Object.entries(OUTPUT_LABELS)
    .map(([key, label]) => `- ${label}：${outputs?.[key] ?? ""}`)
    .join("\n");

const STORY_SYSTEM = `あなたは編集者。会議の参加者が20分で練り上げた「対象領域・課題・解決策」の3点を、1つのストーリーの文章にまとめる。

# ルール
- 250〜350字。「です・ます」調。
- 対象領域 → なぜそれが課題なのか → だからこの解決策、という流れで、3点がつながって読めるようにする。
- 参加者自身の言葉や経験をできるだけ生かす。参加者が言っていないことを付け足さない。
- 一人称は「私」。参加者が自分の提案として読み上げられる文章にする。

# 出力形式（JSONのみ）
{ "story": "文章" }`;

const storyContext = (room, session) =>
  `# お題\n${room.title}\n\n# 決まった3点\n${threePoints(session.outputs)}\n\n# 参加者の発言\n${userWords(session)}`;

const readStory = (raw) =>
  typeof raw?.story === "string" && raw.story.trim() ? raw.story.trim() : "";

// AIの返答が空だったときに、3点だけで組み立てる文章
const fallbackStory = (outputs) =>
  `${outputs.domain}について、私は「${outputs.issue}」が課題だと考えます。そこで「${outputs.solution}」を提案します。`;

export const draftStory = async (room, session) =>
  readStory(
    await kaigiLLM(
      [
        { role: "system", content: STORY_SYSTEM },
        { role: "user", content: storyContext(room, session) },
      ],
      { maxTokens: 1200 }
    )
  ) || fallbackStory(session.outputs);

export const reviseStory = async (room, session, comment) =>
  readStory(
    await kaigiLLM(
      [
        { role: "system", content: STORY_SYSTEM },
        { role: "user", content: storyContext(room, session) },
        {
          role: "assistant",
          content: JSON.stringify({ story: session.story.draft }),
        },
        {
          role: "user",
          content: `参加者からのコメントです。これを反映して書き直してください。\n${comment}`,
        },
      ],
      { maxTokens: 1200 }
    )
  );

const SLIDE_SYSTEM = `あなたは編集者。参加者の提案を、会議室の壁に貼る1枚のスライドにまとめる。

# ルール
- title：提案を一言で表す見出し。30字以内。
- domain / issue / solution：3点をそれぞれ60字以内に。参加者の言葉を生かす。
- summary：ストーリーの要点。100字以内。
- tags：提案の特徴を表す短い言葉を2〜3個（例：「安全」「費用」「高齢者」）。
- 参加者が言っていないことを付け足さない。

# 出力形式（JSONのみ）
{ "title": "", "domain": "", "issue": "", "solution": "", "summary": "", "tags": [] }`;

const clip = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const makeSlide = async (room, session) => {
  const raw = await kaigiLLM(
    [
      { role: "system", content: SLIDE_SYSTEM },
      {
        role: "user",
        content: `# お題\n${room.title}\n\n# 決まった3点\n${threePoints(session.outputs)}\n\n# ストーリー\n${session.story.final}`,
      },
    ],
    { maxTokens: 800 }
  );
  return {
    title: clip(raw?.title, 40) || clip(session.outputs.issue, 40),
    domain: clip(raw?.domain, 120) || session.outputs.domain,
    issue: clip(raw?.issue, 120) || session.outputs.issue,
    solution: clip(raw?.solution, 120) || session.outputs.solution,
    summary: clip(raw?.summary, 200),
    tags: Array.isArray(raw?.tags)
      ? raw.tags
          .filter((t) => typeof t === "string" && t.trim())
          .map((t) => t.trim().slice(0, 12))
          .slice(0, 3)
      : [],
  };
};
