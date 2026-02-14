import mongoose from "mongoose";

const policyDraftSchema = new mongoose.Schema(
  {
    questionId: {
      // 対象とする `sharp_questions` のID
      type: mongoose.Schema.Types.ObjectId,
      ref: "SharpQuestion",
      required: true,
    },
    title: {
      // 政策ドラフトのタイトル
      type: String,
      required: true,
    },
    content: {
      // 政策ドラフトの本文
      type: String,
      required: true,
    },
    sourceProblemIds: [
      {
        // 参考にした `problems` のIDリスト
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem",
      },
    ],
    sourceSolutionIds: [
      {
        // 参考にした `solutions` のIDリスト
        type: mongoose.Schema.Types.ObjectId,
        ref: "Solution",
      },
    ],
    // 問いの contextSets から抽出した代表セット（対象・目的・期待効果）。PolicyDraft 以降のプロンプトで任意利用
    representativeContextSet: {
      type: {
        target: { type: String, default: "" },
        purpose: { type: String, default: "" },
        expectedEffect: { type: String, default: "" },
      },
      default: null,
    },
    version: {
      // バージョン番号
      type: Number,
      required: true,
      default: 1,
    },
  },
  { timestamps: true }
); // createdAt, updatedAt を自動追加 (todo.md指示)

// インデックスを追加（パフォーマンス向上のため）
policyDraftSchema.index({ questionId: 1, createdAt: -1 });

const PolicyDraft = mongoose.model("PolicyDraft", policyDraftSchema);

export default PolicyDraft;
