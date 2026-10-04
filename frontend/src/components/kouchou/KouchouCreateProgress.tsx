import { CheckCircle2, Circle, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { kouchouCreateApi } from "../../services/kouchou/createApiClient";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

const POLL_INTERVAL_MS = 5000;

// 分析の処理段階（kouchou-ai/client-admin/app/page.tsx と同じ順序）
const STEPS = [
  { key: "extraction", label: "意見の抽出" },
  { key: "embedding", label: "意見の位置づけ（埋め込み）" },
  { key: "hierarchical_clustering", label: "似た意見のグループ化" },
  { key: "hierarchical_initial_labelling", label: "グループ名の作成" },
  { key: "hierarchical_merge_labelling", label: "グループ名の統合" },
  { key: "hierarchical_overview", label: "全体のまとめ" },
  { key: "hierarchical_aggregation", label: "集計" },
  { key: "hierarchical_visualization", label: "仕上げ" },
];

interface KouchouCreateProgressProps {
  slug: string;
  password: string;
}

// 新規分析を開始した後の進み具合を表示する
const KouchouCreateProgress = ({
  slug,
  password,
}: KouchouCreateProgressProps) => {
  const [step, setStep] = useState("loading");
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const { current_step } = await kouchouCreateApi.getProgress(
          password,
          slug
        );
        if (cancelled) return;
        setStep(current_step);
        setPollError(null);
        if (current_step === "completed" || current_step === "error") return;
      } catch (err) {
        if (cancelled) return;
        setPollError(
          err instanceof Error ? err.message : "進み具合を取得できませんでした"
        );
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, password]);

  const isCompleted = step === "completed";
  const isError = step === "error";
  const currentIndex = isCompleted
    ? STEPS.length
    : STEPS.findIndex((s) => s.key === step);

  return (
    <Card>
      {isCompleted ? (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-xl-bold mb-2">
            <CheckCircle2 className="h-7 w-7 text-accent-700" />
            分析が完了しました
          </h3>
          <p className="text-base">
            このレポートはURLを知っている人だけが見られる状態です。広聴AIの一覧に載せるには、管理画面で公開設定を「公開」にしてください。
          </p>
        </div>
      ) : isError ? (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-xl-bold mb-2 text-destructive">
            <TriangleAlert className="h-7 w-7" />
            分析中にエラーが発生しました
          </h3>
          <p className="text-base">
            CSVの内容やグループ数の設定を見直して、もう一度お試しください。
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <h3 className="flex items-center gap-2 text-xl-bold mb-2">
            <Loader2 className="h-7 w-7 animate-spin text-primary-700" />
            分析しています
          </h3>
          <p className="text-base">
            数分〜数十分かかります。このページを閉じても分析は続きます。
          </p>
        </div>
      )}

      <ol className="space-y-2 mb-6">
        {STEPS.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex && !isError;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-center gap-2 text-base",
                done || active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-accent-700" />
              ) : active ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary-700" />
              ) : (
                <Circle className="h-5 w-5 text-secondary-300" />
              )}
              <span className={cn(active && "font-bold")}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {pollError && (
        <p className="text-sm text-destructive mb-4">{pollError}</p>
      )}

      <div className="flex flex-wrap gap-3">
        {isCompleted && (
          <Button asChild>
            <Link to={`/kouchou/${encodeURIComponent(slug)}`}>
              レポートを見る
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link to="/kouchou">広聴AIの一覧へ戻る</Link>
        </Button>
      </div>
    </Card>
  );
};

export default KouchouCreateProgress;
