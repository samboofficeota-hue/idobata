import { Download } from "lucide-react";
import type React from "react";

interface DownloadButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  downloadType?: "pdf" | "image";
  data?: unknown; // ダウンロードするデータ（将来の拡張用）
  targetId?: string; // ダウンロード対象の要素ID
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  children,
  onClick,
  className = "",
  downloadType = "pdf",
  data: _data, // 将来の拡張用にインターフェースに保持
  targetId,
}) => {
  const handleDownload = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (downloadType === "pdf") {
      // HTML要素をキャプチャしてPDFとしてダウンロード
      // 実際のコンテンツをキャプチャする
      const contentElement = targetId 
        ? document.getElementById(targetId)
        : document.querySelector(".report-content-for-download");

      if (!contentElement) {
        alert("ダウンロード可能なコンテンツが見つかりません");
        return;
      }

      // html2canvasやjspdfを使用する代わりに、シンプルな方法で実装
      // 将来的にはhtml2canvasライブラリの使用を検討
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 800;
      canvas.height = 1200;

      if (ctx) {
        // 背景を白に設定
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // タイトル
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("レポート", canvas.width / 2, 50);

        // 日付
        const today = new Date();
        const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
        ctx.font = "14px Arial";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "right";
        ctx.fillText(dateStr, canvas.width - 30, 80);

        // コンテンツをテキストとして描画
        ctx.fillStyle = "#1e293b";
        ctx.font = "14px Arial";
        ctx.textAlign = "left";

        const textContent = contentElement.textContent || "データがありません";
        const lines = textContent.split("\n").filter((line) => line.trim());
        let y = 120;
        const lineHeight = 22;
        const maxWidth = canvas.width - 60;

        for (const line of lines) {
          if (y > canvas.height - 80) break;

          // 長い行を折り返す
          const words = line.trim().split("");
          let currentLine = "";

          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine.length > 0) {
              ctx.fillText(currentLine, 30, y);
              currentLine = words[i];
              y += lineHeight;
              if (y > canvas.height - 80) break;
            } else {
              currentLine = testLine;
            }
          }

          if (currentLine) {
            ctx.fillText(currentLine, 30, y);
            y += lineHeight;
          }
        }

        // フッター
        ctx.font = "12px Arial";
        ctx.fillStyle = "#64748b";
        ctx.textAlign = "center";
        ctx.fillText(
          "powered by いどばたビジョン",
          canvas.width / 2,
          canvas.height - 20
        );
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const element = document.createElement("a");
          element.href = URL.createObjectURL(blob);
          element.download = "report.png";
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
        }
      });
    } else if (downloadType === "image") {
      // 画像ダウンロードの実装（イラスト要約用）
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 1200;
      canvas.height = 800;

      if (ctx) {
        // 背景を白に設定
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ヘッダー背景
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, 80);

        // 日付（右上）
        ctx.fillStyle = "#64748b";
        ctx.font = "14px Arial";
        ctx.textAlign = "right";
        ctx.fillText("2025年10月13日", canvas.width - 20, 30);

        // タイトル
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 28px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "「アクティビスト株主と普通の株主」についてのまとめ",
          canvas.width / 2,
          60
        );

        // サブタイトル
        ctx.font = "bold 20px Arial";
        ctx.fillText("重要論点　持続可能な成長を目指す", canvas.width / 2, 90);

        // コンテンツエリア
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(20, 120, canvas.width - 40, canvas.height - 200);

        // コンテンツタイトル
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 18px Arial";
        ctx.textAlign = "left";
        ctx.fillText("アクティビスト投資家と持続可能な成長", 40, 160);

        // サブタイトル
        ctx.font = "16px Arial";
        ctx.fillStyle = "#475569";
        ctx.fillText("現状の課題", 40, 185);

        // 課題項目
        const issues = [
          "1. 自社株買いの影響: 配当と株価の成長を重視するあまり、企業の選択肢を制限する問題があります。",
          "2. 投資の制限: アクティビストの影響で、中長期的な投資が阻害されています。",
          "3. 銀行のチェックポイント不足: 株主は長期的な配当を求めていますが、評価基準が欠如しています。",
          "4. 短期偏重の危険: 企業が短期的な利益に偏り、持続可能性に対する関心が不足しています。",
        ];

        let y = 220;
        for (const issue of issues) {
          // 項目ボックス
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(40, y - 10, canvas.width - 80, 40);
          ctx.strokeStyle = "#e2e8f0";
          ctx.strokeRect(40, y - 10, canvas.width - 80, 40);

          // 項目テキスト
          ctx.fillStyle = "#1e293b";
          ctx.font = "14px Arial";
          ctx.fillText(issue, 50, y + 10);
          y += 60;
        }

        // フッター
        ctx.fillStyle = "#64748b";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "powered by いどばたビジョン",
          canvas.width / 2,
          canvas.height - 20
        );
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const element = document.createElement("a");
          element.href = URL.createObjectURL(blob);
          element.download = "illustration-summary.png";
          document.body.appendChild(element);
          element.click();
          document.body.removeChild(element);
        }
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={`flex items-center gap-2 px-4 py-2 bg-white border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors font-bold text-sm md:text-base ${className}`}
    >
      <Download className="w-5 h-5 md:w-6 md:h-6" />
      {children}
    </button>
  );
};
