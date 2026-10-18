import crypto from "node:crypto";

// 利用者（ログインなし）の ID をサーバーが署名した「利用者トークン」
//  形式: <userId を base64url>.<HMAC-SHA256>
// 以前は端末が決めた userId をそのまま信じていたため、他人の userId を知っていれば
// その人のスレッドや会議室のセッションを操作できた。今は署名の合うトークンを持つ
// 端末だけが、その userId として振る舞える

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const DEV_SECRET = "idobata-dev-user-token-secret";

export const isValidUserId = (value) =>
  typeof value === "string" && USER_ID_PATTERN.test(value);

const signingKey = () => {
  const secret = process.env.USER_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("USER_TOKEN_SECRET (or JWT_SECRET) is not set");
    }
    return crypto.createHash("sha256").update(DEV_SECRET).digest();
  }
  // JWT_SECRET を使う場合も、管理者の JWT とは別の鍵になるように導出する
  return crypto
    .createHash("sha256")
    .update(`idobata-user-token:${secret}`)
    .digest();
};

const mac = (encodedId) =>
  crypto
    .createHmac("sha256", signingKey())
    .update(encodedId)
    .digest("base64url");

export const signUserToken = (userId) => {
  const encodedId = Buffer.from(userId, "utf8").toString("base64url");
  return `${encodedId}.${mac(encodedId)}`;
};

// 正しいトークンなら userId を、そうでなければ null を返す
export const verifyUserToken = (token) => {
  if (typeof token !== "string") return null;
  const [encodedId, signature, extra] = token.split(".");
  if (!encodedId || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(encodedId));
  const actual = Buffer.from(signature);
  if (
    actual.length !== expected.length ||
    !crypto.timingSafeEqual(actual, expected)
  ) {
    return null;
  }
  const userId = Buffer.from(encodedId, "base64url").toString("utf8");
  return isValidUserId(userId) ? userId : null;
};
