import mongoose from "mongoose";

// いどばたの課題・解決策（Problem / Solution）に付ける「声のプロフィール」
// 本体の抽出・分析には使わず、本体のデータも書き換えない。会議室のAIなどが読むための付け足し
// （docs/いどばたの声のプロフィール.md）
//
// 付ける項目は試しながら増やす・減らす・変える前提。値の候補は services/voiceProfile/labels.js

const voiceProfileSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    itemType: { type: String, enum: ["problem", "solution"], required: true },
    themeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // 抽出元（ChatThread または ImportedItem）。同じ抽出元の声は1回でまとめて読む
    sourceOriginId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // プロフィールを作ったときの文のハッシュ。文が書き換わったら作り直す
    statementHash: { type: String, required: true },
    // プロフィールを作ったときの版（Problem / Solution の version）
    itemVersion: { type: Number, default: 1 },

    // 誰の立場からの声か（お題との関わり。年齢・性別などの属性ではない）
    stance: { type: String, default: "unknown" },
    // 何に基づく声か（自分の経験／見聞き／考え）
    evidence: { type: String, default: "unknown" },
    // なぜそう思うか。元の発言に書かれていなければ空（推測で埋めない）
    reason: { type: String, default: "" },
    // 何を大事にしているか（決まった候補から0〜3個）
    values: { type: [String], default: [] },
    // 解決策だけ：その案への懸念・心配。書かれていなければ空
    concern: { type: String, default: "" },
    // 解決策だけ：同じ抽出元の課題のうち、この解決策が答えているもの
    answersProblemIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },

    // どの指示文の版で作ったか（項目を変えたら上げて、作り直す）
    schemaVersion: { type: Number, required: true },
    profiledAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

voiceProfileSchema.index({ itemType: 1, itemId: 1 }, { unique: true });
voiceProfileSchema.index({ themeId: 1 });

const VoiceProfile = mongoose.model("VoiceProfile", voiceProfileSchema);

export default VoiceProfile;
