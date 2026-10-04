import { MessageSquareText, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import ClusterCard from "../components/kouchou/ClusterCard";
import KouchouChart from "../components/kouchou/KouchouChart";
import { clusterColor } from "../components/kouchou/clusterColors";
import { Card } from "../components/ui/card";
import { useKouchouReport } from "../hooks/useKouchouReports";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../services/kouchou/types";

const SAMPLE_ARGUMENT_COUNT = 5;

const KouchouReportDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { result, isLoading, error } = useKouchouReport(slug);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null
  );

  const view = useMemo(() => {
    if (!result) return null;
    const topClusters = result.clusters
      .filter((c) => c.level === 1)
      .sort((a, b) => b.value - a.value);

    const childrenByParent = new Map<string, KouchouCluster[]>();
    for (const c of result.clusters) {
      if (c.level !== 2) continue;
      const list = childrenByParent.get(c.parent) ?? [];
      list.push(c);
      childrenByParent.set(c.parent, list);
    }
    for (const list of childrenByParent.values())
      list.sort((a, b) => b.value - a.value);

    const samplesByCluster = new Map<string, KouchouArgument[]>();
    for (const arg of result.arguments) {
      const id = arg.cluster_ids[1];
      if (!id) continue;
      const list = samplesByCluster.get(id) ?? [];
      if (list.length < SAMPLE_ARGUMENT_COUNT) list.push(arg);
      samplesByCluster.set(id, list);
    }

    const colorByClusterId = new Map(
      topClusters.map((c, i) => [c.id, clusterColor(i)])
    );

    return {
      topClusters,
      colorByClusterId,
      childrenByParent,
      samplesByCluster,
    };
  }, [result]);

  const title = result?.config.question || result?.config.name || "レポート";
  const breadcrumbItems = [
    { label: "広聴AI", href: "/kouchou" },
    { label: title, href: `/kouchou/${slug ?? ""}` },
  ];

  const chartRef = useRef<HTMLElement>(null);

  const toggleCluster = (id: string) =>
    setSelectedClusterId((current) => (current === id ? null : id));

  // 下の意見グループから選んだときは、強調表示された分布図が見える位置まで戻る
  const selectFromCard = (id: string) => {
    if (selectedClusterId !== id) {
      chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    toggleCluster(id);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView items={breadcrumbItems} />

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

      {result && view && (
        <>
          <SectionHeading title={title} />
          <div className="flex flex-wrap gap-4 text-base text-muted-foreground mb-6">
            {result.comment_num !== undefined && (
              <span className="flex items-center">
                <Users className="h-4 w-4 mr-1 text-primary" />
                コメント数：{result.comment_num.toLocaleString()}件
              </span>
            )}
            <span className="flex items-center">
              <MessageSquareText className="h-4 w-4 mr-1 text-primary" />
              抽出された意見：{result.arguments.length.toLocaleString()}件
            </span>
          </div>

          <section ref={chartRef} className="mb-10 scroll-mt-24">
            <SectionHeading title="意見の分布" className="mb-4" />
            <KouchouChart
              arguments={result.arguments}
              clusters={result.clusters}
              topClusters={view.topClusters}
              topColorByClusterId={view.colorByClusterId}
              selectedClusterId={selectedClusterId}
              onSelectCluster={toggleCluster}
            />
          </section>

          <Card className="mb-10">
            <h3 className="text-lg-bold mb-2">全体のまとめ</h3>
            <p className="text-base break-words whitespace-pre-wrap">
              {result.overview}
            </p>
          </Card>

          <section className="mb-12">
            <SectionHeading title="意見グループ" className="mb-4" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {view.topClusters.map((c) => (
                <ClusterCard
                  key={c.id}
                  cluster={c}
                  color={view.colorByClusterId.get(c.id) ?? clusterColor(0)}
                  totalArguments={result.arguments.length}
                  subClusters={view.childrenByParent.get(c.id) ?? []}
                  sampleArguments={view.samplesByCluster.get(c.id) ?? []}
                  isSelected={selectedClusterId === c.id}
                  onSelect={() => selectFromCard(c.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default KouchouReportDetail;
