// NoSQL インジェクション対策：本文・クエリ・パスの値に、MongoDB の演算子
// （$ne、$gt など $ で始まるキー）が混ざっていたら断る。
// 例：{ "userId": { "$ne": null } } を送られると、検索条件が「誰でも」に変わってしまう
// （mongoose の sanitizeFilter はサーバー側の $in なども止めてしまうため、入口で止める）

const MAX_DEPTH = 20;

const hasOperatorKey = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) {
    return value.some((item) => hasOperatorKey(item, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).some(
      (key) => key.startsWith("$") || hasOperatorKey(value[key], depth + 1)
    );
  }
  return false;
};

export const rejectMongoOperators = (req, res, next) => {
  if (
    hasOperatorKey(req.body) ||
    hasOperatorKey(req.query) ||
    hasOperatorKey(req.params)
  ) {
    return res
      .status(400)
      .json({ message: "リクエストの形式が正しくありません" });
  }
  next();
};
