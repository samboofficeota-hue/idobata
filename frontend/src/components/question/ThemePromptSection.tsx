interface ThemePromptSectionProps {
  themeTitle: string;
  themeDescription: string;
  themeTags?: string[];
  participantCount?: number;
  dialogueCount?: number;
}

const ThemePromptSection = ({
  themeTitle,
  themeDescription,
  participantCount = 0,
  dialogueCount = 0,
}: ThemePromptSectionProps) => {
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700">
                重要論点
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              持続可能な成長を目指す
            </h1>
            <p className="text-gray-600 mb-4">
              アクティビスト投資家が中短期の利益を優先する現状があるが、企業が持続可能な成長を追求できるようにしたい。
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                成長
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                投資
              </span>
            </div>
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
