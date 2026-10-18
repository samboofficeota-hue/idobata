import mongoose from "mongoose";

// Google の連携画面へ送り出したときの state と PKCE の検証用の値。
// 戻ってきたときに1回だけ使い、10分で自動削除する

const kaigiOAuthStateSchema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "KaigiRoom",
    required: true,
  },
  codeVerifier: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

kaigiOAuthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiOAuthState = mongoose.model(
  "KaigiOAuthState",
  kaigiOAuthStateSchema
);

export default KaigiOAuthState;
