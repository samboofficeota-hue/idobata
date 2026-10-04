import { useEffect, useState } from "react";
import type { FC } from "react";
import { apiClient } from "../../services/api/apiClient";
import { PROGRESS_STEPS } from "./labels";

const POLL_INTERVAL_MS = 5000;

interface KouchouProgressProps {
  slug: string;
  // 完了・エラーになったら一覧を再読み込みしてもらう
  onFinished: () => void;
}

// 分析中のレポートの進行状況を定期的に取得して表示する
const KouchouProgress: FC<KouchouProgressProps> = ({ slug, onFinished }) => {
  const [step, setStep] = useState<string>("loading");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const result = await apiClient.getKouchouReportProgress(slug);
      if (cancelled) return;
      if (result.isOk()) {
        const current = result.value.current_step;
        setStep(current);
        if (current === "completed" || current === "error") {
          onFinished();
          return;
        }
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, onFinished]);

  const index = PROGRESS_STEPS.findIndex((s) => s.key === step);
  const label = index >= 0 ? PROGRESS_STEPS[index].label : "準備中";

  return (
    <div className="min-w-[10rem]">
      <div className="text-xs text-muted-foreground mb-1">
        {label}
        {index >= 0 && `（${index + 1}/${PROGRESS_STEPS.length}）`}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{
            width: `${((index + 1) / PROGRESS_STEPS.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default KouchouProgress;
