import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import KouchouPasswordDialog from "../components/kouchou/KouchouPasswordDialog";
import KouchouReportCard from "../components/kouchou/KouchouReportCard";
import { Button } from "../components/ui/button";
import { useKouchouReports } from "../hooks/useKouchouReports";
import { storedPassword } from "../services/kouchou/createApiClient";

const KouchouReports = () => {
  const breadcrumbItems = [{ label: "広聴AI", href: "/kouchou" }];
  const { reports, isLoading, error } = useKouchouReports();
  const navigate = useNavigate();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);

  // パスワード確認済み（同じタブで一度入力済み）なら、そのまま新規分析ページへ
  const handleNewAnalysis = () => {
    if (storedPassword.get()) navigate("/kouchou/new");
    else setIsPasswordOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl">
        <BreadcrumbView items={breadcrumbItems} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="広聴AIレポート一覧" className="mb-0" />
          <Button onClick={handleNewAnalysis} className="gap-1">
            <Plus className="h-5 w-5" />
            新規分析
          </Button>
        </div>
        <KouchouPasswordDialog
          open={isPasswordOpen}
          onOpenChange={setIsPasswordOpen}
          onVerified={() => navigate("/kouchou/new")}
        />
        <p className="text-base text-neutral-600 mt-3 mb-8">
          寄せられた多くの意見をAIで分析し、似た意見ごとのグループに整理したレポートです。
          どのような声がどれくらい集まっているのかを、全体像から確かめることができます。
        </p>

        {isLoading && (
          <div className="text-center py-8">
            <p>レポートを読み込み中...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && reports.length === 0 && (
          <div className="text-center py-8">
            <p>公開中のレポートはありません。</p>
          </div>
        )}

        {!isLoading && !error && reports.length > 0 && (
          <div className="grid grid-cols-1 gap-4 mb-12">
            {reports.map((report) => (
              <KouchouReportCard key={report.slug} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KouchouReports;
