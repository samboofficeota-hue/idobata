/**
 * 管理者パスワードの再設定（管理画面にログインできなくなったとき用）。**本番DBを書き換える。**
 *
 * 以前は POST /api/auth/reset を誰でも呼べたため、この用途に使っていたが、
 * それだと誰でも任意のパスワードで管理者を作り直せてしまう。今は API をログイン必須にしたので、代わりにこれを使う。
 * Railway にログインできる人しか実行できない（本番の MONGODB_URI と PASSWORD_PEPPER を railway run で読むため）。
 *
 * 使い方（idea-discussion/backend で実行）:
 *   railway run node scripts/resetAdminPassword.mjs admin@example.com
 * 新しいパスワードを2回聞かれる（入力は表示されない）。
 * そのメールアドレスの管理者がいなければ、admin 権限で新しく作る（名前も聞かれる）。
 */
import readline from "node:readline";
import mongoose from "mongoose";
import AdminUser from "../models/AdminUser.js";

const email = process.argv[2];
if (!email) {
  console.error(
    "使い方: railway run node scripts/resetAdminPassword.mjs <メールアドレス>"
  );
  process.exit(1);
}
if (!process.env.MONGODB_URI || !process.env.PASSWORD_PEPPER) {
  console.error(
    "MONGODB_URI と PASSWORD_PEPPER が必要です。railway run 経由で実行してください。"
  );
  process.exit(1);
}

/** 入力を画面に出さずに1行読む */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const password = await askHidden("新しいパスワード: ");
const confirm = await askHidden("もう一度: ");
if (!password || password !== confirm) {
  console.error("パスワードが空か、2回の入力が一致しません。");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const user = await AdminUser.findOne({ email }).select("+password");
  if (user) {
    user.password = password; // 保存時に AdminUser の pre("save") が PASSWORD_PEPPER 付きでハッシュ化する
    await user.save();
    console.log(`パスワードを再設定しました: ${email}（権限: ${user.role}）`);
  } else {
    const name =
      (await ask("この管理者はまだいません。作成します。名前: ")) || "管理者";
    await new AdminUser({ name, email, password, role: "admin" }).save();
    console.log(`管理者を作成しました: ${email}（権限: admin）`);
  }
} finally {
  await mongoose.disconnect();
}
