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

// AIメンバー1体分の、お題に合わせた肩書き（services/kaigi/personas.js）
// 役割（肯定派・否定派・未定派）は固定なので、ここには持たない
const personaSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
  },
  { _id: false }
);

// ホストがGoogleカレンダーに登録した会議（Google Meet）。参加者にも見せる
const meetingSchema = new mongoose.Schema(
  {
    calendarEventId: { type: String, default: "" },
    calendarHtmlLink: { type: String, default: "" },
    meetUrl: { type: String, default: "" },
    // Meet の会議コード（abc-defg-hij）。文字起こし・録画を探すときに使う
    meetingCode: { type: String, default: "" },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    recordsSyncedAt: { type: Date, default: null },
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
    // AIメンバー3体の肩書き。名前と役割は固定で、お題に合わせた肩書きだけを持つ（空なら肩書きなし）
    personas: {
      member1: { type: personaSchema, default: undefined },
      member2: { type: personaSchema, default: undefined },
      member3: { type: personaSchema, default: undefined },
    },
    // ホスト用の鍵のハッシュ。鍵そのものは作成時に一度だけホストへ返す
    // （この値が空のお題は、ホスト用の画面を使えない）
    // お題に近い、いどばたのテーマ（services/kaigi/roomAxes.js）。AIが選び、ホストが外せる
    themeLink: {
      themeId: { type: mongoose.Schema.Types.ObjectId, default: null },
      themeTitle: { type: String, default: "" },
      // ホストが外したら、自動では紐づけ直さない
      removedByHost: { type: Boolean, default: false },
      // 最後にテーマを探した日時（見つからなかったときも記録する）
      checkedAt: { type: Date, default: null },
    },
    // お題の軸カード：テーマの3軸のうち、お題に関係する軸をお題の言葉で言い直したもの
    // （AIメンバー3体が立つ論点。各側のいどばたの声も添える）
    axes: {
      themeId: { type: mongoose.Schema.Types.ObjectId, default: null },
      themeAxesVersion: { type: Number, default: null },
      items: { type: [mongoose.Schema.Types.Mixed], default: [] },
      builtAt: { type: Date, default: null },
    },
    hostKeyHash: { type: String, default: "", select: false },
    meeting: { type: meetingSchema, default: () => ({}) },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// expiresAt を過ぎたら MongoDB が自動で削除する
kaigiRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiRoom = mongoose.model("KaigiRoom", kaigiRoomSchema);

export default KaigiRoom;
