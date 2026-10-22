/**
 * いどばたの課題・解決策に「声のプロフィール」を付ける（docs/いどばたの声のプロフィール.md）。
 * 本体のデータは読むだけ。書き込むのは voiceprofiles コレクションだけ。
 * OpenAI を呼ぶ（抽出元1つにつき1回）。利用枠は本体と共有なので、授業中には実行しない。
 *
 * 使い方（idea-discussion/backend で実行）:
 *   railway run node scripts/profileVoices.mjs                 # 全テーマ、抽出元20件まで
 *   railway run node scripts/profileVoices.mjs --theme <ID>    # テーマを絞る
 *   railway run node scripts/profileVoices.mjs --limit 100     # 1回に処理する抽出元の数
 *   railway run node scripts/profileVoices.mjs --dry-run       # 作り直しが必要な抽出元を数えるだけ
 */
import mongoose from "mongoose";
import {
  findPendingSources,
  runVoiceProfiling,
} from "../services/voiceProfile/profiler.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const themeId = arg("--theme");
const limit = Number(arg("--limit")) || 20;
const dryRun = process.argv.includes("--dry-run");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI が必要です。railway run 経由で実行してください。");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  if (dryRun) {
    const sources = await findPendingSources({ themeId, limit });
    console.log(`作り直しが必要な抽出元：${sources.length}件（上限 ${limit}）`);
  } else {
    console.log(await runVoiceProfiling({ themeId, limit }));
  }
} finally {
  await mongoose.disconnect();
}
