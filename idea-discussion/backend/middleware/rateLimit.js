import { rateLimit } from "express-rate-limit";

// IPごとの回数制限。AIの呼び出し（OpenAIの利用枠）とログインの総当たりを守る
// 記録はプロセスのメモリに持つ（backend は1台で動かしている前提。台数を増やすときは
// Redis などの共有ストアに替える）。trust proxy は server.js で設定している

const RATE_LIMIT_MESSAGE =
  "短い時間にたくさんの操作がありました。しばらく待ってから、もう一度試してください";

const limiter = (windowMs, limit, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: RATE_LIMIT_MESSAGE },
    // テストでは無効にできる
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
    ...extra,
  });

const MINUTE = 60 * 1000;

// API 全体（画面の表示に必要な読み込みは十分通る数）
export const apiLimiter = limiter(MINUTE, 600);

// 管理者ログイン：15分に10回まで。成功した回は数えない
export const loginLimiter = limiter(15 * MINUTE, 10, {
  skipSuccessfulRequests: true,
});

// 最初の管理者の作成
export const bootstrapLimiter = limiter(60 * MINUTE, 5);

// AIを呼ぶ操作（チャット・会議室の発言など）：1分に20回、1日に300回まで
const llmPerMinute = limiter(MINUTE, 20);
const llmPerDay = limiter(24 * 60 * MINUTE, 300);
export const llmLimiter = [llmPerMinute, llmPerDay];

// 利用者トークンの発行（新しい userId を作り放題にしない）
export const userSessionLimiter = limiter(15 * MINUTE, 60);

// 画像のアップロード
export const uploadLimiter = limiter(15 * MINUTE, 20);
