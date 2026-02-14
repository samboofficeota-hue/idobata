import { Button } from "../ui";

interface ThemePromptSectionProps {
  themeTitle: string;
  themeDescription: string;
  themeTags?: string[];
  participantCount?: number;
  dialogueCount?: number;
  questionTitle?: string;
  questionDescription?: string;
  questionTags?: string[];
  /** 管理画面で作成済みの場合、タイトルカード内に「イラストまとめを見る」ボタンを表示 */
  visualReport?: string | null;
  onOpenIllustration?: () => void;
}

const ThemePromptSection = ({
  themeTitle,
  themeDescription,
  participantCount = 0,
  dialogueCount = 0,
  questionTitle,
  questionDescription,
  questionTags = [],
  visualReport,
  onOpenIllustration,
}: ThemePromptSectionProps) => {
  const hasVisualReport =
    typeof visualReport === "string" &&
    visualReport.length > 0 &&
    !visualReport.includes("<!DOCTYPE html>") &&
    !visualReport.includes("<html");

  return (
    <div className="space-y-6">
      {/* お題の内容をタイトルとして表示 */}
      <div className="space-y-2">
        <h2 className="text-[30px] font-bold leading-[1.62] tracking-[0.025em] text-zinc-800">
          「{themeTitle}」についてのまとめ
        </h2>
        <p className="text-base font-normal leading-8 tracking-[0.025em] text-zinc-800">
          {themeDescription}
        </p>
      </div>

      {/* 選択された重要テーマのカード */}
      <div className="subtle-shadow bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm font-medium text-blue-700">
                重要論点
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {questionTitle || "重要論点"}
            </h1>
            <p className="text-gray-600 mb-4">
              {questionDescription || "質問の説明がありません"}
            </p>
            <div className="flex flex-wrap gap-2">
              {questionTags && questionTags.length > 0
                ? questionTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))
                : null}
            </div>
            {hasVisualReport && onOpenIllustration && (
              <div className="mt-4">
                <Button type="button" onClick={onOpenIllustration}>
                  イラストまとめを見る
                </Button>
              </div>
            )}
          </div>
          <div className="ml-4 text-right">
            <div className="text-sm text-gray-500 mb-1">対話参加人数</div>
            <div className="text-2xl font-bold text-gray-800">
              {participantCount}
            </div>
            <div className="text-sm text-gray-500 mb-1 mt-2">対話数</div>
            <div className="text-2xl font-bold text-gray-800">
              {dialogueCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePromptSection;
