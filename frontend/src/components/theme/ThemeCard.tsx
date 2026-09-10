interface ThemeCardProps {
  title: string;
  description: string;
  /** 1回以上発言した人数（ブラウザ単位）。シャープな問いを生成する前から表示できる */
  participantCount?: number;
}

const ThemeCard = ({
  title,
  description,
  participantCount = 0,
}: ThemeCardProps) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#94B9F9] to-[#9CE0E5] p-6">
      {/* 白色半透明オーバーレイ */}
      <div className="absolute inset-0 bg-white/70" />

      {/* 装飾的な円 */}
      <div className="absolute -top-[310px] -right-[250px] h-[550px] w-[550px] rounded-full border-[100px] border-white/40" />

      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3 min-w-0">
          {/* お題ラベル */}
          <div className="inline-flex items-center justify-center rounded px-4 py-0 bg-white">
            <span className="text-base font-normal text-zinc-800 tracking-[0.025em] leading-8">
              お題
            </span>
          </div>

          {/* タイトル */}
          <h1 className="text-[30px] font-bold leading-[1.62] tracking-[0.025em] text-zinc-800">
            {title}
          </h1>

          {/* 説明文 */}
          <p className="text-base font-normal leading-8 tracking-[0.025em] text-zinc-800">
            {description}
          </p>
        </div>

        {/* 対話参加人数 */}
        <div className="shrink-0 md:text-right">
          <div className="text-sm text-gray-500 mb-1">対話参加人数</div>
          <div className="text-2xl font-bold text-gray-800">
            {participantCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeCard;
