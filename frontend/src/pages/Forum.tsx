import { useEffect, useState } from "react";
import ForumPageTemplate from "../components/forum/ForumPageTemplate";
import { apiClient } from "../services/api/apiClient";
import type { Opinion, Question, Theme } from "../types";

const Forum = () => {
  const [forumData, setForumData] = useState<{
    themes: Theme[];
    questions: Question[];
    opinions: Opinion[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForumData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 統一APIを使用してデータを取得（最適化されたAPI呼び出し）
        const [themesResult, questionsResult, opinionsResult] =
          await Promise.all([
            apiClient.getAllThemesWithStats(),
            apiClient.getAllQuestionsWithStats(),
            apiClient.getOpinions(), // 意見データ専用API
          ]);

        if (!themesResult.isOk()) {
          throw new Error(
            `テーマの取得に失敗しました: ${themesResult.error.message}`
          );
        }

        if (!questionsResult.isOk()) {
          throw new Error(
            `質問の取得に失敗しました: ${questionsResult.error.message}`
          );
        }

        if (!opinionsResult.isOk()) {
          throw new Error(
            `意見データの取得に失敗しました: ${opinionsResult.error.message}`
          );
        }

        setForumData({
          themes: themesResult.value,
          questions: questionsResult.value,
          opinions: opinionsResult.value,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "データの取得に失敗しました";
        setError(errorMessage);
        console.error("Error fetching forum data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchForumData();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 xl:max-w-none">
        <div className="text-center py-8">
          <p>データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 xl:max-w-none">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (forumData) {
    return <ForumPageTemplate {...forumData} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 xl:max-w-none">
      <div className="text-center py-8">
        <p>データを表示できません。</p>
      </div>
    </div>
  );
};

export default Forum;
