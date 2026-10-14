import mongoose from "mongoose";

// 壁に貼り出す提案スライド。会話（KaigiSession）とは分けて小さく持ち、
// 壁を表示するたびに全員の会話を読み込まずに済むようにする

const kaigiSlideSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KaigiRoom",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KaigiSession",
      required: true,
      unique: true,
    },
    nickname: { type: String, required: true },
    title: { type: String, default: "" },
    domain: { type: String, default: "" },
    issue: { type: String, default: "" },
    solution: { type: String, default: "" },
    summary: { type: String, default: "" },
    tags: { type: [String], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

kaigiSlideSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiSlide = mongoose.model("KaigiSlide", kaigiSlideSchema);

export default KaigiSlide;
