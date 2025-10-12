import { X } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";

interface VisualReportData {
  overallAnalysis?: string;
  [key: string]: unknown;
}

interface DebateAxis {
  title: string;
  options?: Array<{
    label: string;
    description: string;
  }>;
}

interface DebateAnalysisData {
  axes?: DebateAxis[];
  agreementPoints?: string[];
  disagreementPoints?: string[];
  [key: string]: unknown;
}

interface ReportIssue {
  title: string;
  description: string;
}

interface ReportExampleData {
  introduction?: string;
  issues?: ReportIssue[];
  [key: string]: unknown;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: "visual" | "debate" | "report";
  reportData: VisualReportData | DebateAnalysisData | ReportExampleData | null;
  questionText: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportData,
  questionText,
}) => {
  const renderVisualReport = () => {
    if (!reportData) return <div>レポートデータがありません</div>;

    const visualData = reportData as VisualReportData;
    const htmlContent = visualData.overallAnalysis || String(visualData);

    return (
      <div className="prose max-w-none">
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: htmlContent,
          }}
        />
      </div>
    );
  };

  const renderDebateAnalysis = () => {
    if (!reportData) return <div>レポートデータがありません</div>;

    const debateData = reportData as DebateAnalysisData;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">問い</h3>
          <p className="text-blue-800">{questionText}</p>
        </div>

        {debateData.axes && debateData.axes.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              主要な論点と対立軸
            </h3>
            <div className="space-y-4">
              {debateData.axes.map((axis, index) => (
                <div
                  key={`axis-${index}-${axis.title}`}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h4 className="font-medium text-gray-900 mb-3">
                    {axis.title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {axis.options?.map((option, optionIndex) => (
                      <div
                        key={`option-${index}-${optionIndex}-${option.label}`}
                        className="bg-gray-50 p-3 rounded"
                      >
                        <div className="font-medium text-gray-800 mb-1">
                          {option.label}
                        </div>
                        <div className="text-sm text-gray-600">
                          {option.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {debateData.agreementPoints &&
          debateData.agreementPoints.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-green-800">
                合意点
              </h3>
              <ul className="space-y-2">
                {debateData.agreementPoints.map((point, index) => (
                  <li
                    key={`agreement-${index}-${point.slice(0, 20)}`}
                    className="flex items-start"
                  >
                    <span className="text-green-600 mr-2">✓</span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {debateData.disagreementPoints &&
          debateData.disagreementPoints.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-red-800">
                対立点
              </h3>
              <ul className="space-y-2">
                {debateData.disagreementPoints.map((point, index) => (
                  <li
                    key={`disagreement-${index}-${point.slice(0, 20)}`}
                    className="flex items-start"
                  >
                    <span className="text-red-600 mr-2">⚠</span>
                    <span className="text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    );
  };

  const renderReportExample = () => {
    if (!reportData) return <div>レポートデータがありません</div>;

    const reportDataTyped = reportData as ReportExampleData;

    return (
      <div className="space-y-6">
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-semibold text-purple-900 mb-2">問い</h3>
          <p className="text-purple-800">{questionText}</p>
        </div>

        {reportDataTyped.introduction && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">概要</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 leading-relaxed">
                {reportDataTyped.introduction}
              </p>
            </div>
          </div>
        )}

        {reportDataTyped.issues && reportDataTyped.issues.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              主要な課題
            </h3>
            <div className="space-y-4">
              {reportDataTyped.issues.map((issue, index) => (
                <div
                  key={`issue-${index}-${issue.title}`}
                  className="border-l-4 border-orange-400 pl-4 py-2"
                >
                  <h4 className="font-medium text-gray-900 mb-2">
                    {issue.title}
                  </h4>
                  <p className="text-gray-700 leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getModalTitle = () => {
    switch (reportType) {
      case "visual":
        return "イラストまとめレポート";
      case "debate":
        return "論点まとめレポート";
      case "report":
        return "市民意見レポート";
      default:
        return "レポート";
    }
  };

  const renderContent = () => {
    switch (reportType) {
      case "visual":
        return renderVisualReport();
      case "debate":
        return renderDebateAnalysis();
      case "report":
        return renderReportExample();
      default:
        return <div>不明なレポートタイプです</div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* モーダルコンテンツ */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {getModalTitle()}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {renderContent()}
        </div>

        {/* フッター */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <Button onClick={onClose} variant="outline">
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};
