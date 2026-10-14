import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import type { KaigiOutputKey, KaigiOutputs } from "../../services/kaigi/types";
import { Button } from "../ui/button";
import { OUTPUT_KEYS, OUTPUT_LABELS } from "./labels";

interface OutputsCardProps {
  outputs: KaigiOutputs;
  missing: KaigiOutputKey[];
  editable: boolean;
  isSaving: boolean;
  onSave: (outputs: KaigiOutputs) => Promise<boolean>;
}

// ダブルダイヤモンドの黄色の3点。AIが書き留めたものを、参加者が自分の言葉に直せる
const OutputsCard = ({
  outputs,
  missing,
  editable,
  isSaving,
  onSave,
}: OutputsCardProps) => {
  const [values, setValues] = useState<KaigiOutputs>(outputs);
  // AIの返答が届くたびに入力中の内容が消えないよう、中身が変わったときだけ合わせる
  useEffect(
    () => setValues(outputs),
    [outputs.domain, outputs.issue, outputs.solution]
  );

  const changed = OUTPUT_KEYS.some((k) => values[k] !== outputs[k]);

  return (
    <section className="rounded-[16px] border-2 border-amber-300 bg-amber-50 p-4">
      <h3 className="mb-3 font-bold">決まったこと</h3>
      <div className="space-y-3">
        {OUTPUT_KEYS.map((key) => (
          <div key={key}>
            <label
              htmlFor={`kaigi-output-${key}`}
              className={cn(
                "text-xs font-bold",
                missing.includes(key) ? "text-rose-700" : "text-neutral-700"
              )}
            >
              {OUTPUT_LABELS[key]}
              {missing.includes(key) && "（次へ進む前に決めてください）"}
            </label>
            <textarea
              id={`kaigi-output-${key}`}
              rows={2}
              value={values[key]}
              disabled={!editable}
              placeholder="まだ決まっていません"
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
              className="mt-1 w-full rounded-md border border-input bg-white px-2 py-1 text-sm disabled:bg-transparent disabled:border-transparent disabled:px-0"
            />
          </div>
        ))}
      </div>
      {editable && changed && (
        <Button
          size="sm"
          className="mt-2"
          disabled={isSaving}
          onClick={() => onSave(values)}
        >
          自分の言葉で直す
        </Button>
      )}
    </section>
  );
};

export default OutputsCard;
