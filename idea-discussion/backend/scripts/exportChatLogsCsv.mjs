/**
 * 対話ログをCSVに書き出すスクリプト（読み取り専用）
 *
 * 指定したテーマの chatthreads を、1発言＝1行のCSVにする。
 * 本番DBには find しか発行しない（インデックス作成も止めている）。
 * 生徒を見分ける userId・sessionId は列に入れない。
 *
 * 使い方（idea-discussion/backend で実行。Railway CLI にログイン済みであること）:
 *   railway run node scripts/exportChatLogsCsv.mjs <出力先.csv> <slug> [<slug> ...]
 *   例: railway run node scripts/exportChatLogsCsv.mjs ~/kitami.csv kitami-0901 kitami-0902
 *
 * 出力:
 * - UTF-8（BOM付き・Excelでそのまま開ける）
 * - 列: クラス, テーマ, スレッド番号, スレッドID, 論点名, 問い, 発言順, 発言者, 本文, 日時（日本時間）
 * - クラスはテーマ名の先頭「（〜）」から取る。無ければ空欄
 * - 発言が1件もないスレッドは出さない。スレッド番号は発言のあるスレッドだけの通し番号（作成順）
 */
import fs from "node:fs";
import mongoose from "mongoose";

const [outPath, ...slugs] = process.argv.slice(2);
if (!outPath || slugs.length === 0) {
  console.error(
    "使い方: railway run node scripts/exportChatLogsCsv.mjs <出力先.csv> <slug> [<slug> ...]"
  );
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error(
    "MONGODB_URI がありません。`railway run node scripts/exportChatLogsCsv.mjs ...` で実行してください。"
  );
  process.exit(1);
}

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const jst = (d) =>
  d
    ? new Date(d)
        .toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" })
        .replace("T", " ")
    : "";

await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
const db = mongoose.connection.db;

const header = [
  "クラス",
  "テーマ",
  "スレッド番号",
  "スレッドID",
  "論点名",
  "問い",
  "発言順",
  "発言者",
  "本文",
  "日時",
];
const lines = [header.map(cell).join(",")];
const summary = [];

for (const slug of slugs) {
  const theme = await db.collection("themes").findOne({ slug });
  if (!theme) {
    console.error(`テーマが見つかりません: ${slug}`);
    process.exit(1);
  }
  const m = theme.title.match(/^（([^）]*)）\s*(.*)$/);
  const cls = m ? m[1].replace(/^北見北斗高校/, "") : "";
  const title = m ? m[2] : theme.title;

  const questions = await db
    .collection("sharpquestions")
    .find({ themeId: theme._id })
    .toArray();
  const qById = new Map(questions.map((q) => [String(q._id), q]));

  const threads = await db
    .collection("chatthreads")
    .find({ themeId: theme._id })
    .sort({ createdAt: 1 })
    .toArray();

  // 発言が1件もないスレッド（画面を開いただけのもの）は除き、残りに通し番号を振る
  const talked = threads.filter((t) => (t.messages || []).length > 0);
  let messageCount = 0;
  talked.forEach((t, i) => {
    const q = t.questionId ? qById.get(String(t.questionId)) : null;
    (t.messages || []).forEach((msg, j) => {
      lines.push(
        [
          cls,
          title,
          i + 1,
          String(t._id),
          q?.tagLine ?? "",
          q?.questionText ?? "",
          j + 1,
          msg.role === "user" ? "生徒" : "AI",
          msg.content,
          jst(msg.timestamp),
        ]
          .map(cell)
          .join(",")
      );
      messageCount++;
    });
  });
  summary.push(
    `${cls || slug}: スレッド ${talked.length}（発言なし ${threads.length - talked.length} を除く） / 発言 ${messageCount}`
  );
}

fs.writeFileSync(outPath, `﻿${lines.join("\r\n")}\r\n`, "utf8");
await mongoose.disconnect();

console.log(summary.join("\n"));
console.log(`書き出し: ${outPath}（${lines.length - 1} 行）`);
