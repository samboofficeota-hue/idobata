import crypto from "node:crypto";

// お題ごとのホスト用の鍵。DB には SHA-256 のハッシュだけを持つ
// （鍵は 256 ビットの乱数なので、ソルトなしのハッシュで十分）

export const hashHostKey = (key) =>
  crypto.createHash("sha256").update(key).digest("hex");

export const hostKeyMatches = (key, storedHash) => {
  if (typeof key !== "string" || !key || !storedHash) return false;
  const actual = Buffer.from(hashHostKey(key), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
};
