import type {
  KouchouReportStatus,
  KouchouVisibility,
} from "../../services/api/types";

export const STATUS_LABELS: Record<KouchouReportStatus, string> = {
  ready: "完了",
  processing: "分析中",
  error: "エラー",
  deleted: "削除済み",
};

export const VISIBILITY_LABELS: Record<KouchouVisibility, string> = {
  public: "公開",
  unlisted: "限定公開（一覧に出さない）",
  private: "非公開",
};

// 分析の処理段階（kouchou-ai/client-admin/app/page.tsx と同じ順序）
export const PROGRESS_STEPS: { key: string; label: string }[] = [
  { key: "extraction", label: "意見の抽出" },
  { key: "embedding", label: "埋め込み" },
  { key: "hierarchical_clustering", label: "グループ化" },
  { key: "hierarchical_initial_labelling", label: "ラベル付け" },
  { key: "hierarchical_merge_labelling", label: "ラベルの統合" },
  { key: "hierarchical_overview", label: "全体のまとめ" },
  { key: "hierarchical_aggregation", label: "集計" },
  { key: "hierarchical_visualization", label: "仕上げ" },
];
