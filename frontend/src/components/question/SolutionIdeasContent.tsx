import { CheckCircle2 } from "lucide-react";
import type { PolicyDraft } from "../../types";
import MarkdownRenderer from "../common/MarkdownRenderer";

/** content を「## 解決手段レポート」で分割し、ビジョン部分と解決手段部分を返す */
function splitPolicyContent(content: string): {
  visionPart: string;
  solutionPart: string;
} {
  const separator = "## 解決手段レポート";
  const idx = content.indexOf(separator);
  if (idx === -1) {
    return { visionPart: content.trim(), solutionPart: "" };
  }
  return {
    visionPart: content.slice(0, idx).replace(/^##\s*ビジョンレポート\s*/i, "").trim(),
    solutionPart: content.slice(idx + separator.length).trim(),
  };
}

interface SolutionIdeasContentProps {
  policyDrafts: PolicyDraft[];
  /** 望ましい姿（HMW）として表示する問いのテキスト */
  questionHmw: string;
}

const SolutionIdeasContent = ({
  policyDrafts,
  questionHmw,
}: SolutionIdeasContentProps) => {
  if (!policyDrafts || policyDrafts.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">
          まだ解決アイディアがありません。
        </p>
        <p className="mt-2 text-sm">
          政策ドラフトが生成されると、ここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {policyDrafts.map((draft, index) => {
        const ctx = draft.representativeContextSet;
        const { visionPart, solutionPart } = splitPolicyContent(draft.content);
        return (
          <div
            key={draft._id}
            className="bg-white rounded-xl border border-green-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
          >
            <div className="p-5 md:p-6 space-y-5">
              {/* カード番号 */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  解決アイディア #{index + 1}
                </span>
              </div>

              {/* 望ましい姿（HMWアプローチ） */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">
                  望ましい姿（HMWアプローチ）
                </h4>
                <p className="text-gray-800 leading-relaxed text-base">
                  {questionHmw}
                </p>
              </div>

              {/* 現状の問題点 */}
              {visionPart && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">
                    現状の問題点
                  </h4>
                  <div className="text-gray-800 leading-relaxed text-base prose prose-sm max-w-none">
                    <MarkdownRenderer markdown={visionPart} />
                  </div>
                </div>
              )}

              {/* 誰に、何のために、何をするか */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">
                  誰に、何のために、何をするか
                </h4>
                <dl className="grid gap-2 text-sm">
                  {ctx?.target && (
                    <div>
                      <dt className="font-medium text-gray-600">誰に</dt>
                      <dd className="text-gray-800 pl-2">{ctx.target}</dd>
                    </div>
                  )}
                  {ctx?.purpose && (
                    <div>
                      <dt className="font-medium text-gray-600">何のために</dt>
                      <dd className="text-gray-800 pl-2">{ctx.purpose}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium text-gray-600">何をするか</dt>
                    <dd className="text-gray-800 pl-2">
                      {draft.title}
                      {solutionPart && (
                        <div className="mt-2 prose prose-sm max-w-none">
                          <MarkdownRenderer markdown={solutionPart} />
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 期待される効果は何か */}
              {ctx?.expectedEffect && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">
                    期待される効果は何か
                  </h4>
                  <p className="text-gray-800 leading-relaxed text-base">
                    {ctx.expectedEffect}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SolutionIdeasContent;
