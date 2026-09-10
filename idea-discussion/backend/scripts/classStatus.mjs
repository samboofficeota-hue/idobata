/**
 * 授業中の稼働確認スクリプト（読み取り専用）
 *
 * サーバーの死活・AI対話の成否・エラー・参加状況を1回でまとめて表示する。
 * 本番DBには find / aggregate / count しか発行しない（インデックス作成も止めている）。
 *
 * 使い方（idea-discussion/backend で実行。Railway CLI にログイン済みであること）:
 *   railway run node scripts/classStatus.mjs            # 直近30分
 *   railway run node scripts/classStatus.mjs 10m        # 直近10分
 *   railway run node scripts/classStatus.mjs 2h
 *
 * 注意:
 * - `railway logs` はデプロイ単位でしかログを返さないので、期間内に動いていたデプロイをすべてたどって合算する。
 * - `railway logs` は1回5,000行が上限。上限に達した項目には「以上」と表示する。
 * - 対話の呼び出しは max_tokens（600 / 1200）で見分けている。chatController の値を変えたら CHAT_MAX_TOKENS も直すこと。
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import mongoose from "mongoose";

const BACKEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const HEALTH_URL =
  "https://idobata-backend-production.up.railway.app/api/health";
const CHAT_MAX_TOKENS = [600, 1200];
const LOG_LIMIT = 5000;

const since = process.argv[2] || "30m";
const sinceMs = parseDuration(since);
const sinceDate = new Date(Date.now() - sinceMs);

function parseDuration(s) {
  const m = /^(\d+)([smhd])$/.exec(s);
  if (!m) {
    console.error(
      `期間は 10m / 30m / 2h のように指定してください（指定値: ${s}）`
    );
    process.exit(1);
  }
  return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
}

const run = promisify(execFile);
const railway = (args) =>
  run("railway", args, {
    cwd: BACKEND_DIR,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).then((r) => r.stdout);

// 実際に動いた（ログがありうる）デプロイの状態
const RAN_STATUSES = new Set([
  "SUCCESS",
  "REMOVED",
  "REMOVING",
  "CRASHED",
  "SLEEPING",
]);

/** 期間内に動いていたデプロイ（期間開始時に動いていた1件＋期間中に作られたもの） */
async function deploymentsInWindow() {
  const list = JSON.parse(
    await railway(["deployment", "list", "--json", "--limit", "50"])
  )
    .filter((d) => RAN_STATUSES.has(d.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const inWindow = list.filter((d) => new Date(d.createdAt) >= sinceDate);
  const runningAtStart = list.find((d) => new Date(d.createdAt) < sinceDate);
  return runningAtStart ? [...inWindow, runningAtStart] : inWindow;
}

/** filter に一致するログ行を、全デプロイ分まとめて返す。取得失敗なら null */
async function railwayLogs(deployments, filter) {
  try {
    const outs = await Promise.all(
      deployments.map((d) =>
        railway([
          "logs",
          d.id,
          "--since",
          since,
          "--lines",
          String(LOG_LIMIT),
          "--filter",
          filter,
        ])
      )
    );
    const perDeployment = outs.map((out) =>
      out.split("\n").filter((line) => line.trim())
    );
    const lines = perDeployment.flat();
    lines.capped = perDeployment.some((l) => l.length >= LOG_LIMIT);
    return lines;
  } catch (e) {
    return null; // CLI 失敗（未ログイン・ネットワーク等）
  }
}

function countText(lines) {
  if (lines === null) return "取得失敗";
  return lines.capped ? `${lines.length}以上` : String(lines.length);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[
    Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))
  ];
}

const fmtTime = (d) =>
  new Date(d).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const warnings = [];
console.log(
  `\n=== 稼働確認 ${fmtTime(sinceDate)}〜${fmtTime(new Date())}（直近${since}） ===\n`
);

// --- 1. サーバー・DBの死活 ---
try {
  const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10000) });
  const h = await res.json();
  const dbOk = h.database?.status === "connected";
  console.log(
    `[サーバー] ${h.status === "healthy" ? "正常" : `異常 (${h.status})`} / DB接続: ${dbOk ? "正常" : `異常 (${h.database?.status})`}`
  );
  if (h.status !== "healthy" || !dbOk) warnings.push("ヘルスチェックが異常");
} catch (e) {
  console.log(`[サーバー] 応答なし (${e.message})`);
  warnings.push("サーバーが応答しない");
}

// --- 2. AI対話（ログ） ---
let deployments = [];
try {
  deployments = await deploymentsInWindow();
  console.log(
    `[デプロイ] 期間内に動いていたもの ${deployments.length}件: ${deployments
      .map(
        (d) =>
          `${fmtTime(d.createdAt)} ${d.status} (${d.meta?.commitHash?.slice(0, 7) ?? "-"})`
      )
      .join(" / ")}`
  );
  if (deployments.some((d) => d.status === "CRASHED"))
    warnings.push("クラッシュしたデプロイがある");
} catch (e) {
  console.log(`[デプロイ] 一覧を取得できません (${e.message.split("\n")[0]})`);
}

const [
  saved,
  chatFailed,
  empty,
  truncated,
  apiErrors,
  rateLimited,
  dropped,
  chatCalls,
] = await Promise.all(
  [
    '"Saved chat thread"',
    '"Error handling new message"',
    // 空の返答は1件で複数行出るので、llmService の1行だけを数える
    '"Error calling" AND "LLM returned empty content"',
    '"TRUNCATED"',
    '"Error calling" AND -"LLM returned empty content"',
    '"status=429" OR "status=529" OR "status=503" OR "overloaded"',
    '"Messages dropped"',
    CHAT_MAX_TOKENS.map((n) => `"max=${n} msgs"`).join(" OR "),
  ].map((filter) =>
    deployments.length
      ? railwayLogs(deployments, filter)
      : Promise.resolve(null)
  )
);

const ms = (chatCalls || [])
  .map((line) => Number(/ ms=(\d+)/.exec(line)?.[1]))
  .filter((n) => Number.isFinite(n))
  .sort((a, b) => a - b);

console.log(
  `[AI対話]   成功 ${countText(saved)} / 失敗 ${countText(chatFailed)}${
    ms.length
      ? `   AI応答時間 中央値 ${(percentile(ms, 0.5) / 1000).toFixed(1)}秒・95% ${(percentile(ms, 0.95) / 1000).toFixed(1)}秒・最大 ${(ms[ms.length - 1] / 1000).toFixed(1)}秒`
      : ""
  }`
);
console.log(
  `[エラー]   空の返答 ${countText(empty)} / 文末切れ ${countText(truncated)} / その他のLLMエラー ${countText(apiErrors)} / レート制限・過負荷 ${countText(rateLimited)}`
);
console.log(`[ログ]     取りこぼし通知 ${countText(dropped)}`);

if (chatFailed?.length) warnings.push(`対話の失敗 ${chatFailed.length}件`);
if (empty?.length) warnings.push(`空の返答 ${empty.length}件`);
if (truncated?.length) warnings.push(`文末切れ ${truncated.length}件`);
if (apiErrors?.length) warnings.push(`その他のLLMエラー ${apiErrors.length}件`);
if (rateLimited?.length)
  warnings.push(`レート制限・過負荷 ${rateLimited.length}件`);
if (dropped?.length)
  warnings.push("ログの取りこぼしあり（件数は実際より少ない可能性）");
if (ms.length && percentile(ms, 0.95) > 20000)
  warnings.push("応答が遅い（95%が20秒超。フロントは30秒でタイムアウト）");
if (
  [
    saved,
    chatFailed,
    empty,
    truncated,
    apiErrors,
    rateLimited,
    dropped,
    chatCalls,
  ].includes(null)
)
  warnings.push(
    "Railway のログ取得に失敗した項目あり（railway login / ネットワークを確認）"
  );

// --- 3. 参加状況（DB・読み取り専用） ---
if (!process.env.MONGODB_URI) {
  console.log(
    "\n[参加状況] MONGODB_URI がありません。`railway run node scripts/classStatus.mjs` で実行してください。"
  );
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: false,
      serverSelectionTimeoutMS: 10000,
    });
    const db = mongoose.connection.db;
    const themes = await db
      .collection("themes")
      .find({ isActive: true }, { projection: { title: 1 } })
      .toArray();
    const ids = themes.map((t) => t._id);

    const [participants, recent, threadCounts, problems, solutions] =
      await Promise.all([
        // 参加人数 = 1回以上発言した userId 数（utils/themeParticipants.js と同じ定義）
        db
          .collection("chatthreads")
          .aggregate([
            { $match: { themeId: { $in: ids }, "messages.role": "user" } },
            { $group: { _id: { t: "$themeId", u: "$userId" } } },
            { $group: { _id: "$_id.t", n: { $sum: 1 } } },
          ])
          .toArray(),
        // 期間内に発言した人数と発言数
        db
          .collection("chatthreads")
          .aggregate([
            {
              $match: { themeId: { $in: ids }, updatedAt: { $gte: sinceDate } },
            },
            { $unwind: "$messages" },
            {
              $match: {
                "messages.role": "user",
                "messages.timestamp": { $gte: sinceDate },
              },
            },
            {
              $group: {
                _id: "$themeId",
                users: { $addToSet: "$userId" },
                msgs: { $sum: 1 },
              },
            },
          ])
          .toArray(),
        db
          .collection("chatthreads")
          .aggregate([
            { $match: { themeId: { $in: ids } } },
            { $group: { _id: "$themeId", n: { $sum: 1 } } },
          ])
          .toArray(),
        db
          .collection("problems")
          .aggregate([
            { $match: { themeId: { $in: ids } } },
            { $group: { _id: "$themeId", n: { $sum: 1 } } },
          ])
          .toArray(),
        db
          .collection("solutions")
          .aggregate([
            { $match: { themeId: { $in: ids } } },
            { $group: { _id: "$themeId", n: { $sum: 1 } } },
          ])
          .toArray(),
      ]);

    const byId = (rows, key = "n") =>
      new Map(rows.map((r) => [r._id.toString(), r[key]]));
    const pMap = byId(participants);
    const tMap = byId(threadCounts);
    const prMap = byId(problems);
    const soMap = byId(solutions);
    const rMap = new Map(recent.map((r) => [r._id.toString(), r]));

    console.log(`\n[参加状況] 公開中のテーマ ${themes.length}件`);
    for (const t of themes) {
      const id = t._id.toString();
      const r = rMap.get(id);
      console.log(
        `  ・${t.title}\n` +
          `      参加人数(累計) ${pMap.get(id) || 0}人 / 直近${since}に発言 ${r?.users.length || 0}人・${r?.msgs || 0}発言` +
          ` / 会話 ${tMap.get(id) || 0} / 意見 ${(prMap.get(id) || 0) + (soMap.get(id) || 0)}（課題${prMap.get(id) || 0}・解決策${soMap.get(id) || 0}）`
      );
    }
  } catch (e) {
    console.log(`\n[参加状況] DBに接続できません (${e.message})`);
    warnings.push("DBに接続できない");
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

// --- 4. 判定 ---
console.log(
  warnings.length ? `\n⚠ 要確認: ${warnings.join(" / ")}\n` : "\n✓ 問題なし\n"
);
