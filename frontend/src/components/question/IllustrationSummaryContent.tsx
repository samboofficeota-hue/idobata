import { ReactNode } from "react";

/** 埋め込み用HTMLにレスポンシブ幅のスタイルを注入し、水色背景の幅に近づける */
function injectResponsiveVisualReportStyles(html: string): string {
  const responsiveStyle = `
<style id="idobata-visual-report-responsive">
  html, body { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }
  body * { box-sizing: border-box !important; }
  /* 375px 等の固定幅をやめ、水色の背景（親）の幅いっぱいに表示 */
  body > div, body > main, body > section { max-width: 100% !important; width: 100% !important; }
  [style*="375px"], [style*="width: 375px"] { width: 100% !important; max-width: 100% !important; }
</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${responsiveStyle}</head>`);
  }
  if (html.includes("<body")) {
    return html.replace(/<body([^>]*)>/, `<body$1>${responsiveStyle}`);
  }
  return html;
}

interface IllustrationSummaryContentProps {
  visualReport?: string | null;
  questionDetail?: {
    visualReport?: string | null;
  } | null;
  /** 全部見るで展開時は表示エリアを大きくする */
  expanded?: boolean;
}

const IllustrationSummaryContent = ({
  visualReport,
  questionDetail,
  expanded = false,
}: IllustrationSummaryContentProps): ReactNode => {
  // HTMLコンテンツかどうかをチェック
  if (visualReport && typeof visualReport === "string") {
    // HTMLコンテンツの場合
    if (
      visualReport.includes("<!DOCTYPE html>") ||
      visualReport.includes("<html")
    ) {
      const htmlWithResponsive = injectResponsiveVisualReportStyles(visualReport);
      return (
        <div
          className={
            expanded
              ? "w-full h-[min(80vh,1200px)]"
              : "w-full h-[600px] md:h-[800px]"
          }
        >
          <iframe
            srcDoc={htmlWithResponsive}
            className="w-full h-full border-0 rounded-2xl"
            title="イラスト要約"
            sandbox="allow-same-origin allow-scripts"
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
        <span className="text-gray-600 text-sm md:text-lg block mb-2 leading-[1.8]">
          {questionDetail === null
            ? "イラスト画像を読み込み中..."
            : visualReport === null
              ? "イラスト画像はまだ生成されていません"
              : "イラスト画像はまだ生成されていません"}
        </span>
        {questionDetail && visualReport === null && (
          <span className="text-gray-500 text-xs block mt-1 leading-[1.8]">
            より多くの意見が集まるとイラスト要約が生成されます
          </span>
        )}
      </div>
    </div>
  );
};

export default IllustrationSummaryContent;
