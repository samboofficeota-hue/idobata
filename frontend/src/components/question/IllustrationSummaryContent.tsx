import { ReactNode } from "react";

interface IllustrationSummaryContentProps {
  visualReport?: string | null;
  questionDetail?: {
    visualReport?: string | null;
  } | null;
}

const IllustrationSummaryContent = ({
  visualReport,
  questionDetail,
}: IllustrationSummaryContentProps): ReactNode => {
  // HTMLコンテンツかどうかをチェック
  if (visualReport && typeof visualReport === "string") {
    // HTMLコンテンツの場合
    if (
      visualReport.includes("<!DOCTYPE html>") ||
      visualReport.includes("<html")
    ) {
      return (
        <div className="w-full h-[600px] md:h-[800px]">
          <iframe
            srcDoc={`
                     <!DOCTYPE html>
                     <html>
                       <head>
                         <meta charset="utf-8">
                         <title>イラスト要約レポート</title>
                         <style>
                           * {
                             margin: 0;
                             padding: 0;
                             box-sizing: border-box;
                           }
                           body {
                             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                             background-color: #ffffff;
                             color: #1e293b;
                             line-height: 1.6;
                           }
                           .report-container {
                             max-width: 1000px;
                             margin: 0 auto;
                             background: white;
                             min-height: 100vh;
                           }
                           .report-header {
                             background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                             padding: 40px 30px;
                             text-align: center;
                             border-bottom: 3px solid #3b82f6;
                           }
                           .report-date {
                             font-size: 14px;
                             color: #64748b;
                             margin-bottom: 20px;
                             text-align: right;
                           }
                           .report-title {
                             font-size: 32px;
                             font-weight: bold;
                             color: #1e293b;
                             margin-bottom: 15px;
                             line-height: 1.3;
                           }
                           .report-subtitle {
                             font-size: 24px;
                             font-weight: 600;
                             color: #3b82f6;
                             margin-bottom: 20px;
                           }
                           .report-content {
                             padding: 40px 30px;
                           }
                           .content-section {
                             margin-bottom: 40px;
                           }
                           .section-title {
                             font-size: 22px;
                             font-weight: bold;
                             color: #1e293b;
                             margin-bottom: 15px;
                             padding-bottom: 10px;
                             border-bottom: 2px solid #e2e8f0;
                           }
                           .section-subtitle {
                             font-size: 18px;
                             font-weight: 600;
                             color: #475569;
                             margin-bottom: 20px;
                           }
                           .issue-item {
                             background: #f8fafc;
                             border: 1px solid #e2e8f0;
                             border-radius: 8px;
                             padding: 20px;
                             margin-bottom: 15px;
                             box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                           }
                           .issue-number {
                             font-weight: bold;
                             color: #3b82f6;
                             margin-right: 10px;
                           }
                           .issue-text {
                             color: #374151;
                             line-height: 1.7;
                           }
                           .report-footer {
                             background: #f8fafc;
                             padding: 30px;
                             text-align: center;
                             border-top: 1px solid #e2e8f0;
                             margin-top: 40px;
                           }
                           .footer-text {
                             font-size: 14px;
                             color: #64748b;
                             font-weight: 500;
                           }
                         </style>
                       </head>
                       <body>
                         <div class="report-container">
                           <div class="report-header">
                             <div class="report-date">2025年10月13日</div>
                             <div class="report-title">「アクティビスト株主と普通の株主」についてのまとめ</div>
                             <div class="report-subtitle">重要論点　持続可能な成長を目指す</div>
                           </div>
                           <div class="report-content">
                             <div class="content-section">
                               <div class="section-title">アクティビスト投資家と持続可能な成長</div>
                               <div class="section-subtitle">現状の課題</div>
                               <div class="issue-item">
                                 <span class="issue-number">1.</span>
                                 <span class="issue-text">自社株買いの影響: 配当と株価の成長を重視するあまり、企業の選択肢を制限する問題があります。</span>
                               </div>
                               <div class="issue-item">
                                 <span class="issue-number">2.</span>
                                 <span class="issue-text">投資の制限: アクティビストの影響で、中長期的な投資が阻害されています。</span>
                               </div>
                               <div class="issue-item">
                                 <span class="issue-number">3.</span>
                                 <span class="issue-text">銀行のチェックポイント不足: 株主は長期的な配当を求めていますが、評価基準が欠如しています。</span>
                               </div>
                               <div class="issue-item">
                                 <span class="issue-number">4.</span>
                                 <span class="issue-text">短期偏重の危険: 企業が短期的な利益に偏り、持続可能性に対する関心が不足しています。</span>
                               </div>
                             </div>
                           </div>
                           <div class="report-footer">
                             <div class="footer-text">powered by いどばたビジョン</div>
                           </div>
                         </div>
                       </body>
                     </html>
                   `}
            className="w-full h-full border-0 rounded-2xl"
            title="イラスト要約"
            sandbox="allow-same-origin"
          />
        </div>
      );
    }
    // 画像URLの場合
    return (
      <img
        src={visualReport}
        alt="イラスト要約"
        className="max-w-full max-h-full object-contain rounded-2xl"
      />
    );
  }

  // 画像がない場合のプレースホルダー
  return (
    <div className="w-full max-w-md md:max-w-2xl h-[300px] md:h-[500px] bg-gray-300 rounded-2xl flex items-center justify-center mx-auto">
      <div className="text-center p-4">
        <span className="text-gray-600 text-sm md:text-lg block mb-2">
          {questionDetail === null
            ? "イラスト画像を読み込み中..."
            : visualReport === null
              ? "イラスト画像はまだ生成されていません"
              : "イラスト画像はまだ生成されていません"}
        </span>
        {questionDetail && visualReport === null && (
          <span className="text-gray-500 text-xs block mt-1">
            より多くの意見が集まるとイラスト要約が生成されます
          </span>
        )}
      </div>
    </div>
  );
};

export default IllustrationSummaryContent;
