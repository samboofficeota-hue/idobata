import { MessageSquareText, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import ClusterCard from "../components/kouchou/ClusterCard";
import ClusterScatter from "../components/kouchou/ClusterScatter";
import { clusterColor } from "../components/kouchou/clusterColors";
import { Card } from "../components/ui/card";
import { useKouchouReport } from "../hooks/useKouchouReports";
import { cn } from "../lib/utils";
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

    return {
      topClusters,
      childrenByParent,
      samplesByCluster,
    };
  }, [result]);

  const title = result?.config.question || result?.config.name || "レポート";
  const breadcrumbItems = [
    { label: "広聴AI", href: "/kouchou" },
    { label: title, href: `/kouchou/${slug ?? ""}` },
  ];

  const toggleCluster = (id: string) =>
    setSelectedClusterId((current) => (current === id ? null : id));

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

          <Card className="mb-10">
            <h3 className="text-lg-bold mb-2">全体のまとめ</h3>
            <p className="text-base break-words whitespace-pre-wrap">
              {result.overview}
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="lg:sticky lg:top-28 self-start">
              <SectionHeading title="意見の分布" className="mb-4" />
              <ClusterScatter
                arguments={result.arguments}
                clusters={view.topClusters}
                selectedClusterId={selectedClusterId}
              />
              <p className="text-sm text-muted-foreground mt-2">
                点の1つ1つが意見です。近くにある意見ほど内容が似ています。点にカーソルを合わせる（スマホではタップする）と意見の本文が表示されます。グループを選ぶと強調表示されます。
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {view.topClusters.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleCluster(c.id)}
                      aria-pressed={selectedClusterId === c.id}
                      className={cn(
                        "flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm transition-colors",
                        selectedClusterId === c.id
                          ? "border-primary-700 bg-primary-weak"
                          : "border-secondary-200 bg-white hover:border-primary-300"
                      )}
                    >
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full",
                          clusterColor(i).bg
                        )}
                      />
                      <span className="max-w-[16rem] truncate">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionHeading title="意見グループ" className="mb-4" />
              <div className="grid grid-cols-1 gap-4 mb-12">
                {view.topClusters.map((c, i) => (
                  <ClusterCard
                    key={c.id}
                    cluster={c}
                    colorIndex={i}
                    totalArguments={result.arguments.length}
                    subClusters={view.childrenByParent.get(c.id) ?? []}
                    sampleArguments={view.samplesByCluster.get(c.id) ?? []}
                    isSelected={selectedClusterId === c.id}
                    onSelect={() => toggleCluster(c.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default KouchouReportDetail;
