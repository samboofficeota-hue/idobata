import ChatThread from "../models/ChatThread.js";

/**
 * テーマごとの対話参加人数を数える。
 * 参加人数 = そのテーマで1回以上発言した userId（ブラウザ単位）の数。
 * 対話画面を開いただけ（ユーザー発言なし）のスレッドは数えない。
 * 1人が複数スレッドを持てるため、ChatThread の件数とは一致しない。
 *
 * @param {Array<import("mongoose").Types.ObjectId>} themeIds
 * @returns {Promise<Map<string, number>>} themeId(文字列) → 参加人数
 */
export async function countParticipantsByTheme(themeIds) {
  if (themeIds.length === 0) return new Map();

  const rows = await ChatThread.aggregate([
    { $match: { themeId: { $in: themeIds }, "messages.role": "user" } },
    { $group: { _id: { themeId: "$themeId", userId: "$userId" } } },
    { $group: { _id: "$_id.themeId", count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.count]));
}
