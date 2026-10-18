import { verifyUserToken } from "../services/userToken.js";

// x-user-token が正しければ req.verifiedUserId に userId を入れる（なければ null）
export const attachUser = (req, res, next) => {
  req.verifiedUserId = verifyUserToken(req.get("x-user-token"));
  next();
};

// 利用者トークンが必要な操作
export const requireUser = (req, res, next) => {
  if (!req.verifiedUserId) {
    return res.status(401).json({
      message: "利用者の確認ができませんでした。ページを読み込み直してください",
    });
  }
  next();
};

// URL などで指定された userId が、トークンの本人と一致するときだけ通す
export const requireSelf = (pick) => (req, res, next) => {
  if (!req.verifiedUserId) return requireUser(req, res, next);
  if (pick(req) !== req.verifiedUserId) {
    return res
      .status(403)
      .json({ message: "ほかの利用者の情報は操作できません" });
  }
  next();
};
