import crypto from "node:crypto";
import DebateAnalysis from "../../models/DebateAnalysis.js";
import Problem from "../../models/Problem.js";
import SharpQuestion from "../../models/SharpQuestion.js";
import Solution from "../../models/Solution.js";
import Theme from "../../models/Theme.js";
import ThemeAxes, { AXIS_SIDES } from "../../models/ThemeAxes.js";
import VoiceProfile from "../../models/VoiceProfile.js";
import { callLLM } from "../llmService.js";

// テーマの3軸を作る（docs/いどばた会議室_キャラと論点カード.md 4章）
// - 本体のデータ（問い・論点分析・課題・解決策・声のプロフィール）は読むだけ。書き込むのは ThemeAxes だけ
// - 骨組みは問いごとの論点分析から作り、各側の中身は元の声に結びつける（まとめのまとめで意味がずれないように）
// - 元にしたもの（分析の版、声の数の段階）が変わったときだけ作り直す

// 指示文や形を変えたら上げる（指紋が変わり、次に動いたときに作り直される）
export const THEME_AXES_SCHEMA_VERSION = 1;
export const MAX_AXES = 3;
// 声がこの数だけ増えたら作り直す
export const VOICE_STEP = 20;
// 仕分けに使う声の数の上限（新しいものから）と、1回の呼び出しで仕分ける数
const MAX_VOICES = 300;
const CLASSIFY_BATCH = 50;
// 残しておく古い版の数
const KEEP_VERSIONS = 3;

const MAX_PROPOSITION = 60;
const MAX_CLAIM = 160;
const MAX_AGREEMENT = 3;

const clip = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// テーマの問いごとに、最新の論点分析を集める
export const loadAnalyses = async (themeId) => {
  const questions = await SharpQuestion.find({
    themeId,
    isVisible: { $ne: false },
  })
    .select("questionText")
    .sort({ _id: 1 })
    .lean();
  const analyses = [];
  for (const q of questions) {
    const latest = await DebateAnalysis.findOne({ questionId: q._id })
      .sort({ version: -1 })
      .lean();
    if (latest) analyses.push({ question: q, analysis: latest });
  }
  return analyses;
};

// テーマの声（新しいものから）と、そのプロフィール
export const loadVoices = async (themeId) => {
  const select = "statement updatedAt";
  const [problems, solutions] = await Promise.all([
    Problem.find({ themeId }).select(select).lean(),
    Solution.find({ themeId }).select(select).lean(),
  ]);
  const voices = [
    ...problems.map((p) => ({ ...p, itemType: "problem" })),
    ...solutions.map((s) => ({ ...s, itemType: "solution" })),
  ]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, MAX_VOICES);
  const profiles = await VoiceProfile.find({
    itemId: { $in: voices.map((v) => v._id) },
  })
    .select("itemType itemId stance evidence reason concern")
    .lean();
  const byKey = new Map(profiles.map((p) => [`${p.itemType}:${p.itemId}`, p]));
  return {
    total: problems.length + solutions.length,
    voices: voices.map((v) => ({
      ...v,
      profile: byKey.get(`${v.itemType}:${v._id}`) ?? null,
    })),
  };
};

export const computeFingerprint = (analyses, voiceTotal) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        schema: THEME_AXES_SCHEMA_VERSION,
        analyses: analyses
          .map((a) => `${a.question._id}:${a.analysis.version}`)
          .sort(),
        voices: Math.floor(voiceTotal / VOICE_STEP),
      })
    )
    .digest("hex");

const list = (items) =>
  items?.length ? items.map((i) => `  - ${i}`).join("\n") : "  - （なし）";

export const buildSkeletonMessages = (theme, analyses) => [
  {
    role: "system",
    content: `あなたは、市民の議論を整理する補助役。ひとつのテーマについて、問いごとに作られた論点分析を読み、テーマ全体として重要な「合意と対立の軸」を最大${MAX_AXES}つにまとめる。

# 軸の書き方
- proposition：「〜すべきか」の形の一文（${MAX_PROPOSITION}字以内）。肯定側と否定側に分かれる問いにする
- agreement：この軸について、ほぼ全員が同じ考えのところ（0〜${MAX_AGREEMENT}個）
- affirmative：肯定側の主張（1〜2文）
- negative：否定側の主張（1〜2文）
- undecidedReason：決めきれない理由。判断に足りない情報や、両方に一理あるところ（1〜2文）
- sources：この軸の元になった問いの ref（Q1 など）

# ルール
- 問いごとの対立軸・対立点・合意点に書かれていることから作る。書かれていない対立をこしらえない。
- 本当の対立が少なければ、軸は1つか2つでよい。対立がなければ空の配列を返す。
- 似た対立は1つの軸にまとめる。軸どうしが重ならないようにする。
- 中立的な言葉で書く。どちらかの側に肩入れしない。

# 出力形式（JSONのみ）
{ "axes": [ { "proposition": "", "agreement": [], "affirmative": "", "negative": "", "undecidedReason": "", "sources": ["Q1"] } ] }`,
  },
  {
    role: "user",
    content: `# テーマ
${theme.title}
${theme.description ? `\n${theme.description}\n` : ""}
# 問いごとの論点分析
${analyses
  .map(
    ({ question, analysis }, i) => `## Q${i + 1}：${question.questionText}
- 対立軸：
${
  (analysis.axes ?? [])
    .map(
      (axis) =>
        `  - ${axis.title}：${(axis.options ?? [])
          .map(
            (o) =>
              `「${o.label}」${o.description ? `（${o.description}）` : ""}`
          )
          .join(" 対 ")}`
    )
    .join("\n") || "  - （なし）"
}
- 対立点：
${list(analysis.disagreementPoints)}
- 合意点：
${list(analysis.agreementPoints)}`
  )
  .join("\n\n")}`,
  },
];

export const normalizeSkeleton = (raw, analyses) => {
  const questionIdByRef = new Map(
    analyses.map((a, i) => [`Q${i + 1}`, a.question._id])
  );
  return (Array.isArray(raw?.axes) ? raw.axes : [])
    .map((a) => ({
      proposition: clip(a?.proposition, MAX_PROPOSITION),
      agreement: (Array.isArray(a?.agreement) ? a.agreement : [])
        .map((x) => clip(x, MAX_CLAIM))
        .filter(Boolean)
        .slice(0, MAX_AGREEMENT),
      affirmative: clip(a?.affirmative, MAX_CLAIM),
      negative: clip(a?.negative, MAX_CLAIM),
      undecidedReason: clip(a?.undecidedReason, MAX_CLAIM),
      sourceQuestionIds: [
        ...new Set(
          (Array.isArray(a?.sources) ? a.sources : [])
            .map((ref) => questionIdByRef.get(ref))
            .filter(Boolean)
            .map(String)
        ),
      ],
    }))
    .filter((a) => a.proposition && a.affirmative && a.negative)
    .slice(0, MAX_AXES)
    .map((a, i) => ({ key: `A${i + 1}`, ...a }));
};

const describeVoice = (v, ref) => {
  const p = v.profile;
  const extra = [
    p?.reason && `理由：${p.reason}`,
    p?.concern && `懸念：${p.concern}`,
  ]
    .filter(Boolean)
    .join("／");
  return `- ${ref}（${v.itemType === "problem" ? "課題" : "解決策"}）：${v.statement}${extra ? `（${extra}）` : ""}`;
};

export const buildClassifyMessages = (axes, voices) => [
  {
    role: "system",
    content: `あなたは、市民の声を整理する補助役。議論の軸と、市民の声（課題・解決策）を読み、それぞれの声がどの軸のどちら側の材料になるかを仕分ける。

# 仕分け方
- axis：その声が一番関係する軸の key（A1 など）。どの軸にも関係しなければ空文字
- side：
  - affirmative：その軸の肯定側の主張を支える声
  - negative：その軸の否定側の主張を支える声。肯定側の案への懸念・反対もこちら
  - undecided：その軸に関係するが、どちらの側とも言えない声（まだどの案も答えていない課題、判断に必要な情報の話など）

# ルール
- 声に書かれていることだけで判断する。推測で側を決めない。迷ったら undecided。
- 1つの声は1つの軸にだけ入れる。

# 出力形式（JSONのみ）
{ "assignments": [ { "ref": "V1", "axis": "A1", "side": "affirmative" } ] }`,
  },
  {
    role: "user",
    content: `# 軸
${axes
  .map(
    (a) =>
      `- ${a.key}：${a.proposition}\n  - 肯定側：${a.affirmative}\n  - 否定側：${a.negative}`
  )
  .join("\n")}

# 声
${voices.map((v, i) => describeVoice(v, `V${i + 1}`)).join("\n")}`,
  },
];

export const normalizeAssignments = (raw, axes, voices) => {
  const axisKeys = new Set(axes.map((a) => a.key));
  const seen = new Set();
  const result = [];
  for (const a of Array.isArray(raw?.assignments) ? raw.assignments : []) {
    const index = /^V(\d+)$/.exec(a?.ref ?? "")?.[1];
    const voice = index ? voices[Number(index) - 1] : undefined;
    if (!voice || seen.has(a.ref)) continue;
    if (!axisKeys.has(a?.axis) || !AXIS_SIDES.includes(a?.side)) continue;
    seen.add(a.ref);
    result.push({
      axis: a.axis,
      itemType: voice.itemType,
      itemId: voice._id,
      side: a.side,
    });
  }
  return result;
};

// テーマ1つ分の3軸を作る。元にしたものが変わっていなければ何もしない
export const buildThemeAxes = async (themeId, { force = false } = {}) => {
  const theme = await Theme.findById(themeId)
    .select("title description")
    .lean();
  if (!theme) return { skipped: "no-theme" };
  const analyses = await loadAnalyses(themeId);
  if (analyses.length === 0) return { skipped: "no-analysis" };
  const { total, voices } = await loadVoices(themeId);
  const fingerprint = computeFingerprint(analyses, total);

  const latest = await ThemeAxes.findOne({ themeId })
    .sort({ version: -1 })
    .select("version fingerprint")
    .lean();
  if (!force && latest?.fingerprint === fingerprint) {
    return { skipped: "unchanged", version: latest.version };
  }

  const axes = normalizeSkeleton(
    await callLLM(buildSkeletonMessages(theme, analyses), true, undefined, {
      max_tokens: 1500,
    }),
    analyses
  );

  // 声を軸の各側に仕分ける。1回の仕分けに失敗しても、ほかの束は続ける
  const assignments = [];
  if (axes.length > 0) {
    for (let i = 0; i < voices.length; i += CLASSIFY_BATCH) {
      const batch = voices.slice(i, i + CLASSIFY_BATCH);
      try {
        const raw = await callLLM(
          buildClassifyMessages(axes, batch),
          true,
          undefined,
          { max_tokens: 200 + batch.length * 30 }
        );
        assignments.push(...normalizeAssignments(raw, axes, batch));
      } catch (error) {
        console.error(
          `[themeAxes] classify failed theme=${themeId}:`,
          error.message
        );
      }
    }
  }

  const version = (latest?.version ?? 0) + 1;
  await ThemeAxes.create({
    themeId,
    version,
    fingerprint,
    schemaVersion: THEME_AXES_SCHEMA_VERSION,
    voiceCount: total,
    sources: analyses.map((a) => ({
      questionId: a.question._id,
      analysisVersion: a.analysis.version,
    })),
    axes: axes.map((axis) => ({
      ...axis,
      voices: assignments
        .filter((v) => v.axis === axis.key)
        .map(({ itemType, itemId, side }) => ({ itemType, itemId, side })),
    })),
  });

  // 古い版は KEEP_VERSIONS 個だけ残す
  await ThemeAxes.deleteMany({
    themeId,
    version: { $lte: version - KEEP_VERSIONS },
  });
  return { version, axes: axes.length, voices: assignments.length };
};

// 有効なテーマ（isActive）の3軸を、必要な分だけ作り直す
let running = false;
export const runThemeAxes = async ({ themeId, force = false } = {}) => {
  if (running) return { skipped: true };
  running = true;
  try {
    const themeIds = themeId
      ? [themeId]
      : (await Theme.find({ isActive: true }).select("_id").lean()).map(
          (t) => t._id
        );
    const results = {};
    for (const id of themeIds) {
      try {
        results[id] = await buildThemeAxes(id, { force });
      } catch (error) {
        results[id] = { failed: error.message };
        console.error(`[themeAxes] failed theme=${id}:`, error.message);
      }
    }
    return results;
  } finally {
    running = false;
  }
};

// 最新の3軸（なければ null）
export const latestThemeAxes = (themeId) =>
  ThemeAxes.findOne({ themeId }).sort({ version: -1 }).lean();
