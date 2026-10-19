/**
 * テーマの3軸を作る（docs/いどばた会議室_キャラと論点カード.md 4章）。
 * 本体のデータは読むだけ。書き込むのは themeaxes コレクションだけ。
 * OpenAI を呼ぶ（テーマ1つにつき、骨組みに1回と、声50件ごとに1回）。利用枠は本体と共有なので、授業中には実行しない。
 * 先に声のプロフィール（scripts/profileVoices.mjs）を作っておくと、仕分けに理由・懸念が使われる。
 *
 * 使い方（idea-discussion/backend で実行）:
 *   railway run node scripts/buildThemeAxes.mjs                # 有効なテーマ全部（元が変わったものだけ作り直す）
 *   railway run node scripts/buildThemeAxes.mjs --theme <ID>   # テーマを絞る
 *   railway run node scripts/buildThemeAxes.mjs --force        # 元が変わっていなくても作り直す
 */
import mongoose from "mongoose";
import { runThemeAxes } from "../services/themeAxes/builder.js";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI が必要です。railway run 経由で実行してください。");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  console.log(
    await runThemeAxes({
      themeId: arg("--theme"),
      force: process.argv.includes("--force"),
    })
  );
} finally {
  await mongoose.disconnect();
}
