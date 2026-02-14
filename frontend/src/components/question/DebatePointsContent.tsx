import MarkdownRenderer from "../common/MarkdownRenderer";

interface DebateAxis {
  title: string;
  options?: {
    label: string;
    description: string;
  }[];
}

interface DebateData {
  axes?: DebateAxis[];
  agreementPoints?: string[];
  disagreementPoints?: string[];
  formattedReport?: string | null;
}

interface DebatePointsContentProps {
  debateData: DebateData | null | undefined;
}

const DebatePointsContent = ({ debateData }: DebatePointsContentProps) => {
  if (!debateData) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">論点データを読み込み中...</p>
      </div>
    );
  }

  // フォーマット済みレポートがある場合はiframeで表示
  if (debateData.formattedReport && typeof debateData.formattedReport === "string") {
    // HTMLコンテンツかどうかをチェック
    if (
      debateData.formattedReport.includes("<!DOCTYPE html>") ||
      debateData.formattedReport.includes("<html")
    ) {
      return (
        <div className="w-full h-[600px] md:h-[800px]">
          <iframe
            srcDoc={debateData.formattedReport}
            className="w-full h-full border-0 rounded-2xl"
            title="みんなの論点レポート"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      );
    }
  }

  // データが存在するかチェック
  const hasAxes = debateData.axes && debateData.axes.length > 0;
  const hasAgreementPoints =
    debateData.agreementPoints && debateData.agreementPoints.length > 0;
  const hasDisagreementPoints =
    debateData.disagreementPoints && debateData.disagreementPoints.length > 0;

  // すべてのデータが空の場合
  if (!hasAxes && !hasAgreementPoints && !hasDisagreementPoints) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-base leading-relaxed">
          論点データがまだ生成されていません。
        </p>
        <p className="mt-2 text-sm">
          対話が集まると、AIによって論点が自動的に抽出・分析されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* 主要な論点と対立軸 */}
      {hasAxes && (
        <div>
          <div className="border-b border-gray-300 pb-2 mb-4">
            <h4 className="text-2xl font-bold text-gray-800">
              主要な論点と対立軸
            </h4>
          </div>

          <div className="space-y-6">
            {/* 対立軸の表示 */}
            {debateData.axes?.map((axis) => (
              <div key={axis.title}>
                <h5 className="text-xl font-bold text-gray-800 mb-2">
                  {axis.title}
                </h5>
                <div className="pl-6 space-y-4">
                  {axis.options && axis.options.length > 0 ? (
                    axis.options.map((option) => (
                      <div key={option.label}>
                        <h6 className="font-bold text-gray-800 mb-1">
                          {option.label}
                        </h6>
                        <div className="text-gray-800 leading-8">
                          <MarkdownRenderer markdown={option.description} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm">
                      選択肢の情報がありません
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 合意点の表示 */}
      {hasAgreementPoints && (
        <div>
          <div className="border-b border-gray-300 pb-2 mb-4">
            <h4 className="text-2xl font-bold text-gray-800">合意点</h4>
          </div>
          <div className="pl-6 space-y-2">
            {debateData.agreementPoints.map((point) => (
              <div key={point} className="text-gray-800 leading-8 flex gap-2">
                <span>•</span>
                <div className="flex-1">
                  <MarkdownRenderer markdown={point} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 対立点の表示 */}
      {hasDisagreementPoints && (
        <div>
          <div className="border-b border-gray-300 pb-2 mb-4">
            <h4 className="text-2xl font-bold text-gray-800">対立点</h4>
          </div>
          <div className="pl-6 space-y-2">
            {debateData.disagreementPoints.map((point) => (
              <div key={point} className="text-gray-800 leading-8 flex gap-2">
                <span>•</span>
                <div className="flex-1">
                  <MarkdownRenderer markdown={point} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebatePointsContent;
