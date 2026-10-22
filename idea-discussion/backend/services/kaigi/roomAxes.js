import Problem from "../../models/Problem.js";
import Solution from "../../models/Solution.js";
import Theme from "../../models/Theme.js";
import ThemeAxes from "../../models/ThemeAxes.js";
import VoiceProfile from "../../models/VoiceProfile.js";
import { latestThemeAxes } from "../themeAxes/builder.js";
import { kaigiLLM } from "./llm.js";

// お題の軸カード（docs/いどばた会議室_キャラと論点カード.md 5章）
// お題に近いいどばたのテーマを選び、そのテーマの3軸のうち、お題に関係する軸をお題の言葉で言い直す
// 3体のキャラは、参加者が工程4に入った時点のカードに立つ（routes/kaigiRoutes.js で固定する）
// テーマが紐づかない・関係する軸がないときは、カードなし（みんなの声の整理の対立点を仮の軸にする）

const MAX_ROOM_AXES = 3;
const VOICES_PER_SIDE = 3;
// テーマが見つからなかったお題で、もう一度探すまでの間隔
const REPICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const clip = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const buildThemePickMessages = (room, themes) => [
  {
    role: "system",
    content: `あなたは話し合いの場づくりを手伝う補助役。会議のお題と、市民の意見を集めた「テーマ」の一覧を読み、お題に一番近いテーマを1つ選ぶ。

# ルール
- お題と同じ話題（同じ困りごと・同じ施策）を扱っているテーマだけを選ぶ。言葉が少し似ているだけなら選ばない。
- 近いテーマがなければ、空文字を返す。

# 出力形式（JSONのみ）
{ "theme": "T1" }`,
  },
  {
    role: "user",
    content: `# お題
${room.title}

# 背景
${room.background || "（なし）"}

# テーマの一覧
${themes.map((t, i) => `- T${i + 1}：${t.title}${t.description ? `（${clip(t.description, 120)}）` : ""}`).join("\n")}`,
  },
];

export const buildRoomAxesMessages = (room, themeTitle, axes) => [
  {
    role: "system",
    content: `あなたは話し合いの場づくりを手伝う補助役。会議のお題と、市民の意見から作った「テーマの合意と対立の軸」を読み、お題に関係する軸を選んで、お題の言葉で言い直す。

# ルール
- お題に関係する軸だけを選ぶ（最大${MAX_ROOM_AXES}つ）。関係する軸がなければ空の配列を返す。
- 言い直すときに、軸の意味（どこで合意し、どこで分かれるか）を変えない。肯定側と否定側を入れ替えない。
- proposition は「〜すべきか」の形の一文（60字以内）。affirmative・negative・undecidedReason は1〜2文。agreement は0〜3個。
- source には元の軸の key（A1 など）を入れる。

# 出力形式（JSONのみ）
{ "axes": [ { "source": "A1", "proposition": "", "agreement": [], "affirmative": "", "negative": "", "undecidedReason": "" } ] }`,
  },
  {
    role: "user",
    content: `# お題
${room.title}

# 背景
${room.background || "（なし）"}

# テーマ「${themeTitle}」の軸
${axes
  .map(
    (a) => `## ${a.key}：${a.proposition}
- 合意：${a.agreement?.length ? a.agreement.join("／") : "（なし）"}
- 肯定側：${a.affirmative}
- 否定側：${a.negative}
- 決めきれない理由：${a.undecidedReason || "（なし）"}`
  )
  .join("\n\n")}`,
  },
];

export const normalizeRoomAxes = (raw, themeAxes) => {
  const byKey = new Map(themeAxes.map((a) => [a.key, a]));
  const used = new Set();
  return (Array.isArray(raw?.axes) ? raw.axes : [])
    .filter((a) => byKey.has(a?.source) && !used.has(a.source))
    .map((a) => {
      used.add(a.source);
      const base = byKey.get(a.source);
      return {
        source: a.source,
        proposition: clip(a.proposition, 60) || base.proposition,
        agreement: (Array.isArray(a.agreement) ? a.agreement : base.agreement)
          .map((x) => clip(x, 160))
          .filter(Boolean)
          .slice(0, 3),
        affirmative: clip(a.affirmative, 160) || base.affirmative,
        negative: clip(a.negative, 160) || base.negative,
        undecidedReason: clip(a.undecidedReason, 160) || base.undecidedReason,
      };
    })
    .slice(0, MAX_ROOM_AXES)
    .map((a, i) => ({ key: `R${i + 1}`, ...a }));
};

// 軸の各側の声を、いどばたから読む（理由の書かれた声を先に、各側 VOICES_PER_SIDE 件まで）
export const loadAxisVoices = async (axis) => {
  const ids = (type) =>
    axis.voices.filter((v) => v.itemType === type).map((v) => v.itemId);
  const [problems, solutions, profiles] = await Promise.all([
    Problem.find({ _id: { $in: ids("problem") } })
      .select("statement")
      .lean(),
    Solution.find({ _id: { $in: ids("solution") } })
      .select("statement")
      .lean(),
    VoiceProfile.find({ itemId: { $in: axis.voices.map((v) => v.itemId) } })
      .select("itemType itemId reason concern")
      .lean(),
  ]);
  const statements = new Map([
    ...problems.map((p) => [`problem:${p._id}`, p.statement]),
    ...solutions.map((s) => [`solution:${s._id}`, s.statement]),
  ]);
  const profileByKey = new Map(
    profiles.map((p) => [`${p.itemType}:${p.itemId}`, p])
  );

  const sides = { affirmative: [], negative: [], undecided: [] };
  for (const v of axis.voices) {
    const key = `${v.itemType}:${v.itemId}`;
    const statement = statements.get(key);
    // 元の声が消えていたら使わない
    if (!statement || !sides[v.side]) continue;
    const profile = profileByKey.get(key);
    sides[v.side].push({
      kind: v.itemType === "problem" ? "課題" : "解決策",
      statement: clip(statement, 120),
      reason: profile?.reason ?? "",
      concern: profile?.concern ?? "",
    });
  }
  for (const side of Object.keys(sides)) {
    sides[side] = sides[side]
      .sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)))
      .slice(0, VOICES_PER_SIDE);
  }
  return sides;
};

const pickTheme = async (room) => {
  const themeIds = await ThemeAxes.distinct("themeId", {
    "axes.0": { $exists: true },
  });
  if (themeIds.length === 0) return null;
  const themes = await Theme.find({ _id: { $in: themeIds } })
    .select("title description")
    .sort({ _id: 1 })
    .lean();
  if (themes.length === 0) return null;
  const raw = await kaigiLLM(buildThemePickMessages(room, themes), {
    maxTokens: 100,
  });
  const index = /^T(\d+)$/.exec(raw?.theme ?? "")?.[1];
  return index ? (themes[Number(index) - 1] ?? null) : null;
};

const buildCard = async (room, themeTitle, themeAxes) => {
  const raw = await kaigiLLM(
    buildRoomAxesMessages(room, themeTitle, themeAxes.axes),
    { maxTokens: 1200 }
  );
  const items = normalizeRoomAxes(raw, themeAxes.axes);
  const bySource = new Map(themeAxes.axes.map((a) => [a.key, a]));
  for (const item of items) {
    item.voices = await loadAxisVoices(bySource.get(item.source));
  }
  return items;
};

// 同じお題で同時に作らないようにする
const inflight = new Map();

// お題のテーマを選び（まだなら）、テーマの3軸が新しくなっていればカードを作り直す
// 失敗してもエラーにしない（カードなしで、仮の軸で進む）
export const ensureRoomAxes = async (room, now = new Date()) => {
  const key = room._id.toString();
  if (inflight.has(key)) {
    // 別の読み込みで作っている最中なら、できたものをこのお題の手元にも写す
    await inflight.get(key);
    const fresh = await room.constructor
      .findById(room._id)
      .select("themeLink axes")
      .lean();
    if (fresh?.themeLink) room.set("themeLink", fresh.themeLink);
    if (fresh?.axes) room.set("axes", fresh.axes);
    return room.axes;
  }
  const job = (async () => {
    try {
      if (room.themeLink?.removedByHost) return;

      let themeId = room.themeLink?.themeId;
      let themeTitle = room.themeLink?.themeTitle ?? "";
      const checkedAt = room.themeLink?.checkedAt;
      if (!themeId && (!checkedAt || now - checkedAt >= REPICK_INTERVAL_MS)) {
        const theme = await pickTheme(room);
        themeId = theme?._id ?? null;
        themeTitle = theme?.title ?? "";
        room.themeLink = {
          themeId,
          themeTitle,
          removedByHost: false,
          checkedAt: now,
        };
      }
      if (!themeId) {
        if (room.isModified()) await room.save();
        return;
      }

      const latest = await latestThemeAxes(themeId);
      const current = room.axes;
      if (
        !latest ||
        (String(current?.themeId) === String(themeId) &&
          current?.themeAxesVersion === latest.version)
      ) {
        if (room.isModified()) await room.save();
        return;
      }
      room.axes = {
        themeId,
        themeAxesVersion: latest.version,
        items: await buildCard(room, themeTitle, latest),
        builtAt: now,
      };
      await room.save();
    } catch (error) {
      console.error(`[kaigi/roomAxes] failed room=${room._id}:`, error.message);
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  await job;
  return room.axes;
};
