import { useEffect, useState } from "react";
import TopPageTemplate from "../components/top/TopPageTemplate";
import { apiClient } from "../services/api/apiClient";
import type { Opinion, Question, Theme } from "../types";

const Top = () => {
  const [topPageData, setTopPageData] = useState<{
    latestThemes: Theme[];
    latestQuestions?: Question[];
    latestOpinions?: Opinion[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopPageData = async () => {
      setIsLoading(true);
      setError(null);

      const result = await apiClient.getTopPageData();

      if (!result.isOk()) {
        setError(`データの取得に失敗しました: ${result.error.message}`);
        console.error("Error fetching top page data:", result.error);
        setIsLoading(false);
        return;
      }
      setTopPageData(result.value);
      setIsLoading(false);
    };

    fetchTopPageData();
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

  if (topPageData) {
    return (
      <TopPageTemplate latestThemes={topPageData.latestThemes || []} />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 xl:max-w-none">
      <div className="text-center py-8">
        <p>データを表示できません。</p>
      </div>
    </div>
  );
};

export default Top;
