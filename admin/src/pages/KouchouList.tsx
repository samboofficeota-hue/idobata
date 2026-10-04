import { useCallback, useEffect, useState } from "react";
import type { FC } from "react";
import KouchouReportTable from "../components/kouchou/KouchouReportTable";
import { apiClient } from "../services/api/apiClient";
import type { KouchouReport } from "../services/api/types";

const KouchouList: FC = () => {
  const [reports, setReports] = useState<KouchouReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    const result = await apiClient.getKouchouReports();
    result.match(
      (data) => {
        // 新しい分析を上に表示する
        const sorted = [...data].sort((a, b) =>
          (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
        );
        setReports(sorted);
        setError(null);
      },
      (error) => {
        console.error("Failed to fetch kouchou reports:", error);
        setError(`分析一覧の取得に失敗しました。${error.message}`);
      }
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDelete = async (slug: string) => {
    if (
      !confirm("この分析を削除しますか？公開ページからも見られなくなります。")
    ) {
      return;
    }
    const result = await apiClient.deleteKouchouReport(slug);
    result.match(
      () => fetchReports(),
      (error) => {
        console.error("Failed to delete kouchou report:", error);
        alert(`分析の削除に失敗しました。${error.message}`);
      }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">広聴AI 分析一覧</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        広聴AIで作成した分析の管理（タイトル・調査概要・公開設定の変更、削除）を行います。新しい分析は、利用者向けサイトの「広聴AI」ページの「新規分析」から始めます（パスワードが必要です）。公開設定を「公開」にした分析は、利用者向けサイトの「広聴AI」ページに表示されます。
      </p>

      {loading ? (
        <div className="text-center py-4">読み込み中...</div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>
      ) : (
        <KouchouReportTable
          reports={reports}
          onDelete={handleDelete}
          onProgressFinished={fetchReports}
        />
      )}
    </div>
  );
};

export default KouchouList;
