import mongoose from "mongoose";

// いどばた会議室の「お題」。ホストが作り、参加者はこのお題に対して20分で提案を練り上げる
// 一定期間後に自動で削除する（expiresAt の TTL インデックス）

// ホストが選べる参加人数の枠（料金の段階と同じ。課金は未実装）
export const KAIGI_CAPACITIES = [5, 10, 50];

const overviewSchema = new mongoose.Schema(
  {
    // 工程3「俯瞰」で全員に見せる整理。お題ごとに1回作って使い回す
    issueCandidates: { type: [String], default: [] },
    ideaCandidates: { type: [String], default: [] },
    conflicts: { type: [String], default: [] },
    agreements: { type: [String], default: [] },
    // 何人分の声から作ったか（0 ならお題と背景だけから作った候補）
    voiceCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const kaigiRoomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    background: { type: String, default: "", maxlength: 4000 },
    hostName: { type: String, default: "", trim: true, maxlength: 50 },
    capacity: {
      type: Number,
      enum: KAIGI_CAPACITIES,
      default: KAIGI_CAPACITIES[0],
    },
    overview: { type: overviewSchema, default: () => ({}) },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// expiresAt を過ぎたら MongoDB が自動で削除する
kaigiRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiRoom = mongoose.model("KaigiRoom", kaigiRoomSchema);

export default KaigiRoom;
