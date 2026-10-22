import mongoose from "mongoose";

// テーマの3軸（docs/いどばた会議室_キャラと論点カード.md 4章）
// いどばた本体の問いごとの論点分析（DebateAnalysis）の上に重ねる、テーマ全体としての合意・対立の軸（最大3つ）
// 本体のデータは読むだけ。作り直すたびに版を上げ、古い版もいくつか残す

export const AXIS_SIDES = ["affirmative", "negative", "undecided"];

const axisVoiceSchema = new mongoose.Schema(
  {
    itemType: { type: String, enum: ["problem", "solution"], required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    side: { type: String, enum: AXIS_SIDES, required: true },
  },
  { _id: false }
);

const axisSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // A1〜A3
    // 「〜すべきか」の形の一文
    proposition: { type: String, required: true },
    // この軸で、ほぼ全員が同じ考えのところ（未定派の足場）
    agreement: { type: [String], default: [] },
    affirmative: { type: String, default: "" }, // 肯定側の主張（肯定派が立つ）
    negative: { type: String, default: "" }, // 否定側の主張（否定派が立つ）
    undecidedReason: { type: String, default: "" }, // 決めきれない理由（未定派が立つ）
    // どの問いの論点から来たか
    sourceQuestionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    // この軸に結びつけた、いどばたの声（元の声をたどれるように、IDで持つ）
    voices: { type: [axisVoiceSchema], default: [] },
  },
  { _id: false }
);

const themeAxesSchema = new mongoose.Schema(
  {
    themeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true },
    // 元にしたもの（問いごとの分析の版と、声の数の段階）の指紋。変わったら作り直す
    fingerprint: { type: String, required: true },
    axes: { type: [axisSchema], default: [] },
    // 元にした問いごとの論点分析と、その版
    sources: {
      type: [
        {
          questionId: mongoose.Schema.Types.ObjectId,
          analysisVersion: Number,
          _id: false,
        },
      ],
      default: [],
    },
    voiceCount: { type: Number, default: 0 },
    schemaVersion: { type: Number, required: true },
  },
  { timestamps: true }
);

themeAxesSchema.index({ themeId: 1, version: -1 }, { unique: true });

const ThemeAxes = mongoose.model("ThemeAxes", themeAxesSchema);

export default ThemeAxes;
