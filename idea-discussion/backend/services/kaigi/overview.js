import KaigiSession from "../../models/KaigiSession.js";
import { kaigiLLM } from "./llm.js";

// 工程3「みんなの声を見る」で全員に見せる整理。お題ごとに1回だけ作り、全員で使い回す
// （1人ずつ作ると、人数分の声を人数回読むことになり、AIの利用枠をすぐ使い切るため）

const MAX_VOICES = 50;
const MAX_VOICE_LENGTH = 600;
// 新しい声が増えても、作り直すのはこの間隔より空いたときだけ
const REFRESH_INTERVAL_MS = 60 * 1000;

// 同じお題で同時に作り直しが走らないようにする
const inflight = new Map();

// 工程2を終えた参加者の書き込みを集める（誰が書いたかは渡さない）
export const collectVoices = async (roomId) => {
  const sessions = await KaigiSession.find({ roomId, step: { $gte: 3 } })
    .select("messages")
    .sort({ updatedAt: -1 })
    .limit(MAX_VOICES)
    .lean();
  return sessions
    .map((s) =>
      s.messages
        .filter((m) => m.speaker === "user" && m.step === 2)
        .map((m) => m.content)
        .join("\n")
        .slice(0, MAX_VOICE_LENGTH)
    )
    .filter((v) => v.trim());
};

export const buildOverviewMessages = (room, voices) => {
  const voiceText = voices.length
    ? voices.map((v, i) => `## 声${i + 1}\n${v}`).join("\n\n")
    : "（まだ誰の声も集まっていない。お題と背景だけから、考えられる候補を挙げる）";
  return [
    {
      role: "system",
      content: `あなたは会議の論点を整理する補助役。お題に対する参加者の声を読み、課題の候補・解決アイディアの候補・主な論点（対立点と合意点）を整理する。

# ルール
- 誰が言ったかは書かない。何人が言ったかも書かない。
- 課題の候補は「誰が、どんなことで困っているか」が分かる形にする。
- 候補はそれぞれ3〜5個、1つ40字以内。中立的な言葉で書く。
- 対立点・合意点は、声が少なければ0〜2個でよい。無理に作らない。

# 出力形式（JSONのみ）
{ "issueCandidates": [], "ideaCandidates": [], "conflicts": [], "agreements": [] }`,
    },
    {
      role: "user",
      content: `# お題\n${room.title}\n\n# 背景\n${room.background || "（なし）"}\n\n# 参加者の声\n${voiceText}`,
    },
  ];
};

const strings = (value, max = 5) =>
  Array.isArray(value)
    ? value
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim().slice(0, 80))
        .slice(0, max)
    : [];

const regenerate = async (room) => {
  const voices = await collectVoices(room._id);
  const raw = await kaigiLLM(buildOverviewMessages(room, voices), {
    maxTokens: 1200,
  });
  room.overview = {
    issueCandidates: strings(raw?.issueCandidates),
    ideaCandidates: strings(raw?.ideaCandidates),
    conflicts: strings(raw?.conflicts, 3),
    agreements: strings(raw?.agreements, 3),
    voiceCount: voices.length,
    updatedAt: new Date(),
  };
  await room.save();
  return room.overview;
};

// 作り直しが必要か（まだない／新しい声が増えて、前回から一定時間たった）
export const needsRefresh = (overview, voiceCount, now = new Date()) => {
  if (!overview?.updatedAt) return true;
  if (voiceCount === overview.voiceCount) return false;
  return now - new Date(overview.updatedAt) >= REFRESH_INTERVAL_MS;
};

export const ensureOverview = async (room) => {
  const key = room._id.toString();
  if (inflight.has(key)) return inflight.get(key);

  const voiceCount = await KaigiSession.countDocuments({
    roomId: room._id,
    step: { $gte: 3 },
  });
  if (!needsRefresh(room.overview, Math.min(voiceCount, MAX_VOICES))) {
    return room.overview;
  }

  const job = regenerate(room).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
};
