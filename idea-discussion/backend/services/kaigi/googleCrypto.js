import crypto from "node:crypto";

// Google のリフレッシュトークンを保存するときの暗号化（AES-256-GCM）
// 鍵は KAIGI_GOOGLE_TOKEN_KEY（32バイトを base64 にしたもの）。
// 作り方：node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const VERSION = "v1";

const loadKey = () => {
  const raw = process.env.KAIGI_GOOGLE_TOKEN_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
};

export const tokenKeyConfigured = () => loadKey() !== null;

export const encryptToken = (plain) => {
  const key = loadKey();
  if (!key) throw new Error("KAIGI_GOOGLE_TOKEN_KEY is not a 32-byte key");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body]
    .map((part) => (typeof part === "string" ? part : part.toString("base64")))
    .join(":");
};

export const decryptToken = (stored) => {
  const key = loadKey();
  if (!key) throw new Error("KAIGI_GOOGLE_TOKEN_KEY is not a 32-byte key");
  const [version, iv, tag, body] = String(stored).split(":");
  if (version !== VERSION || !iv || !tag || !body) {
    throw new Error("unknown token format");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64")),
    decipher.final(),
  ]).toString("utf8");
};
