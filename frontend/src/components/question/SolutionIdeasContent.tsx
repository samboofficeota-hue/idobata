import { CheckCircle2 } from "lucide-react";

interface SolutionIdea {
  id: string;
  idea: string;
}

interface SolutionIdeasContentProps {
  solutionIdeas: SolutionIdea[];
}

const SolutionIdeasContent = ({
  solutionIdeas,
}: SolutionIdeasContentProps) => {
  if (!solutionIdeas || solutionIdeas.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        まだ解決アイディアが集まっていません。チャットで意見を投稿すると、解決アイディアとして表示されます。
      </div>
    );
  }

  // Maximum 4 ideas (already limited in backend, but ensure here too)
  const displayIdeas = solutionIdeas.slice(0, 4);

  return (
    <div className="space-y-4">
      {displayIdeas.map((idea, index) => (
        <div
          key={idea.id}
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
              </div>
              <p className="text-gray-800 leading-relaxed text-base">
                {idea.idea}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SolutionIdeasContent;
