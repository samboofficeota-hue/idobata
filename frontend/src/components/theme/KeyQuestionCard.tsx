import { Heart, MessageSquare } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardTitle } from "../../components/ui/card";
import { Link } from "../../contexts/MockContext";

interface KeyQuestionCardProps {
  question: string;
  tagLine?: string;
  tags?: string[];
  voteCount: number;
  issueCount: number;
  solutionCount: number;
  themeId: string;
  qid: string;
}

const KeyQuestionCard = ({
  question,
  tagLine,
  tags,
  voteCount,
  issueCount,
  themeId,
  qid,
}: KeyQuestionCardProps) => {
  const [localVoteCount, setLocalVoteCount] = useState(voteCount);
  const [isVoted, setIsVoted] = useState(false);
  return (
    <Link to={`/themes/${themeId}/questions/${qid}`} className="block">
      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary-700">
        <CardContent className="p-4">
          {tagLine ? (
            <>
              <CardTitle className="font-semibold text-lg mb-2">
                {tagLine}
              </CardTitle>
              <p className="text-base text-muted-foreground mb-3">{question}</p>
            </>
          ) : (
            <CardTitle className="font-semibold text-lg mb-3">
              {question}
            </CardTitle>
          )}

          <div className="flex flex-wrap gap-3 text-base text-muted-foreground">
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2 w-full">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="border border-gray-300 rounded-full px-2 py-0.5 text-sm text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <button
              className={`flex items-center transition-colors ${
                isVoted
                  ? "text-red-500 hover:text-red-600"
                  : "hover:text-primary-600"
              }`}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                try {
                  if (isVoted) {
                    // 既に投票済みの場合は共感を削除
                    const response = await fetch(
                      `${import.meta.env.VITE_API_BASE_URL}/api/questions/${qid}/like`,
                      {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          targetType: "question",
                          targetId: qid,
                        }),
                      }
                    );

                    if (response.ok) {
                      setLocalVoteCount((prev) => Math.max(0, prev - 1));
                      setIsVoted(false);
                    } else {
                      console.error("共感の削除に失敗しました");
                    }
                  } else {
                    // 未投票の場合は共感を追加
                    const response = await fetch(
                      `${import.meta.env.VITE_API_BASE_URL}/api/questions/${qid}/like`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          targetType: "question",
                          targetId: qid,
                        }),
                      }
                    );

                    if (response.ok) {
                      setLocalVoteCount((prev) => prev + 1);
                      setIsVoted(true);
                    } else {
                      console.error("共感の追加に失敗しました");
                    }
                  }
                } catch (error) {
                  console.error("共感の操作中にエラーが発生しました:", error);
                }
              }}
            >
              <Heart
                className={`h-4 w-4 mr-1 ${isVoted ? "fill-current" : ""}`}
              />
              共感する: {localVoteCount}
            </button>
            <span className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-1 text-primary" />
              投稿数: {issueCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default KeyQuestionCard;
