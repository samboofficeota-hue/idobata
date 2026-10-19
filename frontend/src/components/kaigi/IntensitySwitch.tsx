import { cn } from "../../lib/utils";
import type { KaigiIntensity } from "../../services/kaigi/types";
import { INTENSITY_OPTIONS } from "./labels";

interface IntensitySwitchProps {
  value: KaigiIntensity;
  disabled: boolean;
  onChange: (value: KaigiIntensity) => void;
}

// AIメンバーの問い詰める強さ。問い詰められるのは本人だけなので、本人がいつでも選び直せる
const IntensitySwitch = ({
  value,
  disabled,
  onChange,
}: IntensitySwitchProps) => (
  <fieldset className="rounded-md border bg-white p-3">
    <legend className="px-1 text-sm font-bold">AIメンバーの問いかけ</legend>
    <div className="flex gap-1">
      {INTENSITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => value !== option.value && onChange(option.value)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-sm disabled:opacity-60",
            value === option.value
              ? "border-primary-700 bg-primary-700 text-white"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
    <p className="mt-2 text-xs text-neutral-500">次の発言から変わります。</p>
  </fieldset>
);

export default IntensitySwitch;
