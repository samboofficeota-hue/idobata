import { cn } from "../../lib/utils";
import { STEP_LABELS } from "./labels";

// ダブルダイヤモンドの左（課題を見つける）と右（解決を見つける）を色で分けて、10工程の現在地を示す
const side = (step: number) =>
  step >= 2 && step <= 5 ? "left" : step >= 6 && step <= 8 ? "right" : "none";

const StepIndicator = ({ step }: { step: number }) => (
  <div>
    <p className="text-sm text-neutral-600 mb-2">
      工程 {step} / 10
      <span className="ml-3 font-bold text-foreground">
        {STEP_LABELS[step]}
      </span>
    </p>
    <ol className="grid grid-cols-10 gap-1" aria-label="工程">
      {Object.keys(STEP_LABELS).map((key) => {
        const n = Number(key);
        const s = side(n);
        return (
          <li
            key={n}
            title={`${n}. ${STEP_LABELS[n]}`}
            aria-current={n === step ? "step" : undefined}
            className={cn(
              "h-2 rounded-full",
              n < step && s === "left" && "bg-rose-300",
              n < step && s === "right" && "bg-sky-300",
              n < step && s === "none" && "bg-neutral-300",
              n === step && s === "left" && "bg-rose-500",
              n === step && s === "right" && "bg-sky-500",
              n === step && s === "none" && "bg-neutral-600",
              n > step && "bg-neutral-100"
            )}
          />
        );
      })}
    </ol>
    <div className="mt-1 grid grid-cols-10 gap-1 text-[10px] text-neutral-500">
      <span className="col-start-2 col-span-4 text-center">
        正しい問題を見つける
      </span>
      <span className="col-span-3 text-center">正しい解決を見つける</span>
    </div>
  </div>
);

export default StepIndicator;
