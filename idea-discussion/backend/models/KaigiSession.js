import mongoose from "mongoose";

// 参加者1人分の20分。会話・決まった3点・ストーリー・スライドを持つ
// 同時に書き込んでもぶつからないよう、参加者ごとに別のドキュメントにする

export const KAIGI_SPEAKERS = [
  "user",
  "facilitator",
  "member1",
  "member2",
  "member3",
  "editor",
];

const messageSchema = new mongoose.Schema(
  {
    speaker: { type: String, enum: KAIGI_SPEAKERS, required: true },
    content: { type: String, required: true },
    step: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const kaigiSessionSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KaigiRoom",
      required: true,
      index: true,
    },
    // いどばたの利用者ID（ログインなし。端末ごとに振られる）
    userId: { type: String, required: true },
    nickname: { type: String, required: true, trim: true, maxlength: 30 },
    // 工程（1〜10）。設計ドキュメント v2 の第5章と同じ番号
    step: { type: Number, default: 1, min: 1, max: 10 },
    // 工程ごとに入った時刻（残り時間の計算に使う）
    stepStartedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },
    messages: { type: [messageSchema], default: [] },
    // ダブルダイヤモンドの黄色の3点
    outputs: {
      domain: { type: String, default: "" },
      issue: { type: String, default: "" },
      solution: { type: String, default: "" },
    },
    story: {
      draft: { type: String, default: "" },
      final: { type: String, default: "" },
    },
    slide: {
      title: { type: String, default: "" },
      domain: { type: String, default: "" },
      issue: { type: String, default: "" },
      solution: { type: String, default: "" },
      summary: { type: String, default: "" },
      tags: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ["active", "submitted"],
      default: "active",
    },
    submittedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

kaigiSessionSchema.index({ roomId: 1, userId: 1 }, { unique: true });
kaigiSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiSession = mongoose.model("KaigiSession", kaigiSessionSchema);

export default KaigiSession;
