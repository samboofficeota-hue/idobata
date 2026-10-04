import type { FC } from "react";
import { Link } from "react-router-dom";
import type { KouchouReport } from "../../services/api/types";
import { Button } from "../ui/button";
import KouchouProgress from "./KouchouProgress";
import { STATUS_LABELS, VISIBILITY_LABELS } from "./labels";

interface KouchouReportTableProps {
  reports: KouchouReport[];
  onDelete: (slug: string) => void;
  onProgressFinished: () => void;
}

const STATUS_CLASSES: Record<KouchouReport["status"], string> = {
  ready: "bg-success text-success-foreground",
  processing: "bg-info text-info-foreground",
  error: "bg-destructive text-destructive-foreground",
  deleted: "bg-muted text-muted-foreground",
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ja-JP");
};

const KouchouReportTable: FC<KouchouReportTableProps> = ({
  reports,
  onDelete,
  onProgressFinished,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-background border border-border">
        <thead>
          <tr className="bg-muted">
            <th className="py-2 px-4 border-b text-left">タイトル</th>
            <th className="py-2 px-4 border-b text-left">状態</th>
            <th className="py-2 px-4 border-b text-left">公開設定</th>
            <th className="py-2 px-4 border-b text-left">作成日時</th>
            <th className="py-2 px-4 border-b text-right">費用（推定）</th>
            <th className="py-2 px-4 border-b text-center">アクション</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="py-4 text-center text-muted-foreground"
              >
                まだ分析がありません。利用者向けサイトの「広聴AI」ページから作成できます。
              </td>
            </tr>
          ) : (
            reports.map((report) => (
              <tr key={report.slug} className="hover:bg-muted/50">
                <td className="py-2 px-4 border-b">
                  <div className="font-medium">{report.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {report.slug}
                  </div>
                </td>
                <td className="py-2 px-4 border-b">
                  {report.status === "processing" ? (
                    <KouchouProgress
                      slug={report.slug}
                      onFinished={onProgressFinished}
                    />
                  ) : (
                    <span
                      className={`inline-block whitespace-nowrap px-2 py-1 rounded-full text-xs ${STATUS_CLASSES[report.status]}`}
                    >
                      {STATUS_LABELS[report.status]}
                    </span>
                  )}
                </td>
                <td className="py-2 px-4 border-b text-sm">
                  {VISIBILITY_LABELS[report.visibility]}
                </td>
                <td className="py-2 px-4 border-b text-sm">
                  {formatDate(report.createdAt)}
                </td>
                <td className="py-2 px-4 border-b text-sm text-right">
                  {report.estimatedCost != null
                    ? `$${report.estimatedCost.toFixed(2)}`
                    : "—"}
                </td>
                <td className="py-2 px-4 border-b">
                  <div className="flex justify-center space-x-2">
                    <Link to={`/kouchou/${encodeURIComponent(report.slug)}`}>
                      <Button variant="secondary">編集</Button>
                    </Link>
                    <Button
                      variant="destructive"
                      onClick={() => onDelete(report.slug)}
                      disabled={report.status === "processing"}
                    >
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default KouchouReportTable;
