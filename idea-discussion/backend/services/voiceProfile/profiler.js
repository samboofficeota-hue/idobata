import crypto from "node:crypto";
import ChatThread from "../../models/ChatThread.js";
import ImportedItem from "../../models/ImportedItem.js";
import Problem from "../../models/Problem.js";
import Solution from "../../models/Solution.js";
import VoiceProfile from "../../models/VoiceProfile.js";
import { callLLM } from "../llmService.js";
import {
  EVIDENCES,
  MAX_CONCERN_LENGTH,
  MAX_REASON_LENGTH,
  MAX_VALUES,
  PROFILE_SCHEMA_VERSION,
  STANCES,
  VALUES,
} from "./labels.js";

// いどばたの課題・解決策に「声のプロフィール」を付ける
// - 本体のデータ（Problem / Solution / ChatThread / ImportedItem）は読むだけで、書き換えない
// - 抽出元（対話1つ、または取り込んだ意見1件）ごとに、AIの呼び出しは1回
// - 文が書き換わった声（ハッシュが変わった）、まだない声、項目の版が古い声だけを作り直す

const MAX_SOURCE_TEXT = 4000;

export const hashStatement = (statement) =>
  crypto
    .createHash("sha256")
    .update(String(statement ?? ""))
    .digest("hex");

// プロフィールを作り直す必要があるか
export const needsProfile = (item, profile) =>
  !profile ||
  profile.statementHash !== hashStatement(item.statement) ||
  (profile.schemaVersion ?? 0) < PROFILE_SCHEMA_VERSION;

// 抽出元の文章。対話なら利用者の発言だけを読む（AIの発言は読まない）
export const loadSourceText = async (sourceOriginId) => {
  const thread = await ChatThread.findById(sourceOriginId)
    .select("messages")
    .lean();
  if (thread) {
    return thread.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n")
      .slice(0, MAX_SOURCE_TEXT);
  }
  const imported = await ImportedItem.findById(sourceOriginId)
    .select("content")
    .lean();
  return (imported?.content ?? "").slice(0, MAX_SOURCE_TEXT);
};

const listLabels = (labels) =>
  Object.entries(labels)
    .map(([key, text]) => `- ${key}：${text}`)
    .join("\n");

// items：同じ抽出元の課題・解決策。ref（P1, S1…）で呼び分ける
export const buildProfileMessages = (sourceText, items) => [
  {
    role: "system",
    content: `あなたは、市民の声を整理する補助役。利用者が書いた元の文章と、そこから抽出された「課題」「解決策」を読み、1件ずつに属性を付ける。

# 付ける属性
## stance（誰の立場からの声か。お題との関わり方で選ぶ）
${listLabels(STANCES)}

## evidence（何に基づく声か）
${listLabels(EVIDENCES)}

## reason（なぜそう思うか）
元の文章に書かれている理由・経験を、${MAX_REASON_LENGTH}字以内で。書かれていなければ空文字。

## values（何を大事にしているか）
次の中から0〜${MAX_VALUES}個：${VALUES.join("、")}

## concern（解決策だけ）
その案について元の文章に書かれている懸念・心配を、${MAX_CONCERN_LENGTH}字以内で。書かれていなければ空文字。

## answers（解決策だけ）
この解決策が答えている課題の ref（P1 など）。同じ文章の中の課題から選ぶ。なければ空の配列。

# ルール
- 元の文章に書かれていることだけで判断する。推測で補わない。読み取れなければ unknown や空にする。
- 年齢・性別・国籍・病気・信条など、人そのものの属性は書かない。
- 個人名・住所・連絡先など、人を特定できることは書かない。

# 出力形式（JSONのみ）
{ "items": [ { "ref": "P1", "stance": "", "evidence": "", "reason": "", "values": [], "concern": "", "answers": [] } ] }`,
  },
  {
    role: "user",
    content: `# 元の文章（利用者が書いたもの）
${sourceText || "（元の文章を読めなかった。抽出された文だけで判断する）"}

# 抽出された課題・解決策
${items.map((i) => `- ${i.ref}（${i.itemType === "problem" ? "課題" : "解決策"}）：${i.statement}`).join("\n")}`,
  },
];

const clip = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const pick = (value, labels) =>
  typeof value === "string" && value in labels ? value : "unknown";

// AIの返答を、決まった候補と長さに収める。返ってこなかった声は null
export const normalizeProfiles = (raw, items) => {
  const byRef = new Map(
    (Array.isArray(raw?.items) ? raw.items : [])
      .filter((r) => typeof r?.ref === "string")
      .map((r) => [r.ref, r])
  );
  const problemIdByRef = new Map(
    items.filter((i) => i.itemType === "problem").map((i) => [i.ref, i.itemId])
  );
  return items.map((item) => {
    const r = byRef.get(item.ref);
    if (!r) return null;
    const isSolution = item.itemType === "solution";
    return {
      stance: pick(r.stance, STANCES),
      evidence: pick(r.evidence, EVIDENCES),
      reason: clip(r.reason, MAX_REASON_LENGTH),
      values: [
        ...new Set(
          (Array.isArray(r.values) ? r.values : []).filter((v) =>
            VALUES.includes(v)
          )
        ),
      ].slice(0, MAX_VALUES),
      concern: isSolution ? clip(r.concern, MAX_CONCERN_LENGTH) : "",
      answersProblemIds: isSolution
        ? [
            ...new Set(
              (Array.isArray(r.answers) ? r.answers : [])
                .map((ref) => problemIdByRef.get(ref))
                .filter(Boolean)
                .map(String)
            ),
          ]
        : [],
    };
  });
};

const toItems = (problems, solutions) => [
  ...problems.map((p, i) => ({
    ...p,
    itemId: p._id,
    itemType: "problem",
    ref: `P${i + 1}`,
  })),
  ...solutions.map((s, i) => ({
    ...s,
    itemId: s._id,
    itemType: "solution",
    ref: `S${i + 1}`,
  })),
];

// 抽出元1つ分の声に、まとめてプロフィールを付ける（AIの呼び出しは1回）
export const profileSource = async (sourceOriginId) => {
  const select = "statement version themeId sourceOriginId";
  const [problems, solutions] = await Promise.all([
    Problem.find({ sourceOriginId }).select(select).sort({ _id: 1 }).lean(),
    Solution.find({ sourceOriginId }).select(select).sort({ _id: 1 }).lean(),
  ]);
  const items = toItems(problems, solutions);
  if (items.length === 0) return 0;

  const sourceText = await loadSourceText(sourceOriginId);
  const raw = await callLLM(
    buildProfileMessages(sourceText, items),
    true,
    undefined,
    { max_tokens: 300 + items.length * 150 }
  );
  const profiles = normalizeProfiles(raw, items);

  const ops = items
    .map((item, i) => [item, profiles[i]])
    .filter(([, profile]) => profile)
    .map(([item, profile]) => ({
      updateOne: {
        filter: { itemType: item.itemType, itemId: item.itemId },
        update: {
          $set: {
            ...profile,
            themeId: item.themeId,
            sourceOriginId: item.sourceOriginId,
            statementHash: hashStatement(item.statement),
            itemVersion: item.version ?? 1,
            schemaVersion: PROFILE_SCHEMA_VERSION,
            profiledAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
  if (ops.length > 0) await VoiceProfile.bulkWrite(ops);
  return ops.length;
};

// プロフィールの作成・作り直しが必要な抽出元を探す（新しい声、書き換わった声、版が古い声）
export const findPendingSources = async ({ themeId, limit = 20 } = {}) => {
  const filter = themeId ? { themeId } : {};
  const select = "statement sourceOriginId";
  const [problems, solutions] = await Promise.all([
    Problem.find(filter).select(select).lean(),
    Solution.find(filter).select(select).lean(),
  ]);
  const profiles = await VoiceProfile.find(filter)
    .select("itemType itemId statementHash schemaVersion")
    .lean();
  const profileByKey = new Map(
    profiles.map((p) => [`${p.itemType}:${p.itemId}`, p])
  );

  const pending = new Set();
  for (const [itemType, list] of [
    ["problem", problems],
    ["solution", solutions],
  ]) {
    for (const item of list) {
      if (needsProfile(item, profileByKey.get(`${itemType}:${item._id}`))) {
        pending.add(String(item.sourceOriginId));
      }
      if (pending.size >= limit) return [...pending];
    }
  }
  return [...pending];
};

// 元の声がなくなったプロフィールを消す
export const removeOrphanProfiles = async ({ themeId } = {}) => {
  const filter = themeId ? { themeId } : {};
  const [problemIds, solutionIds] = await Promise.all([
    Problem.distinct("_id", filter),
    Solution.distinct("_id", filter),
  ]);
  const result = await VoiceProfile.deleteMany({
    ...filter,
    $or: [
      { itemType: "problem", itemId: { $nin: problemIds } },
      { itemType: "solution", itemId: { $nin: solutionIds } },
    ],
  });
  return result.deletedCount ?? 0;
};

// 必要な分だけ作る。1回に処理する抽出元の数を limit で抑える（OpenAIの利用枠は本体と共有）
let running = false;
export const runVoiceProfiling = async ({ themeId, limit = 20 } = {}) => {
  if (running) return { skipped: true };
  running = true;
  const summary = { sources: 0, profiled: 0, failed: 0, removed: 0 };
  try {
    const sources = await findPendingSources({ themeId, limit });
    for (const sourceOriginId of sources) {
      try {
        summary.profiled += await profileSource(sourceOriginId);
        summary.sources += 1;
      } catch (error) {
        summary.failed += 1;
        console.error(
          `[voiceProfile] failed source=${sourceOriginId}:`,
          error.message
        );
      }
    }
    summary.removed = await removeOrphanProfiles({ themeId });
    return summary;
  } finally {
    running = false;
  }
};
