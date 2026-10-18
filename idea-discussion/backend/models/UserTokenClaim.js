import mongoose from "mongoose";

// 利用者トークンを発行済みの userId。1つの userId には最初に名乗り出た端末にだけ
// トークンを出す（あとから同じ userId を名乗っても、別の新しい userId になる）
const userTokenClaimSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("UserTokenClaim", userTokenClaimSchema);
