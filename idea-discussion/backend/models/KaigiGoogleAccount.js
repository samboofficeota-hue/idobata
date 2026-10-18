import mongoose from "mongoose";

// お題ごとに、ホストが連携したGoogleアカウント。お題（KaigiRoom）とは分けて持ち、
// お題を読み込むたびにトークンが一緒に読み出されないようにする
// リフレッシュトークンは暗号化して保存する（services/kaigi/googleCrypto.js）

const kaigiGoogleAccountSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KaigiRoom",
      required: true,
      unique: true,
    },
    googleSub: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    scopes: { type: [String], default: [] },
    refreshTokenEnc: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

kaigiGoogleAccountSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiGoogleAccount = mongoose.model(
  "KaigiGoogleAccount",
  kaigiGoogleAccountSchema
);

export default KaigiGoogleAccount;
