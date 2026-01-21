import { CheckCircle2 } from "lucide-react";

interface Solution {
  _id: string;
  statement: string;
  relevanceScore?: number;
}

interface SolutionIdeasContentProps {
  solutions: Solution[];
}

const SolutionIdeasContent = ({ solutions }: SolutionIdeasContentProps) => {
  if (!solutions || solutions.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        まだ解決アイディアが集まっていません。チャットで意見を投稿すると、解決アイディアとして表示されます。
      </div>
    );
  }

  // 関連度の高い順にソート
  const sortedSolutions = [...solutions].sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );

  return (
    <div className="space-y-4">
      {sortedSolutions.map((solution, index) => (
        <div
          key={solution._id}
          className="bg-white rounded-lg border border-green-200 shadow-sm hover:shadow-md transition-all duration-200 p-5"
        >
          <div className="flex items-start gap-4">
            {/* アイコン */}
            <div className="flex-shrink-0 mt-1">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  解決アイディア #{index + 1}
                </span>
                {solution.relevanceScore !== undefined && (
                  <span className="text-xs text-gray-500">
                    関連度: {Math.round(solution.relevanceScore * 100)}%
                  </span>
                )}
              </div>
              <p className="text-gray-800 leading-relaxed text-base">
                {solution.statement}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SolutionIdeasContent;
