import HeroSection from "../../components/home/HeroSection";
import ThemeCard from "../../components/home/ThemeCard";
import type { Opinion, Question, Theme } from "../../types";
import {
  transformQuestionsToTableItems,
  transformThemesToFeaturedQuestions,
  transformThemesToLatestThemes,
} from "../../utils/forumDataTransformers";
import BreadcrumbView from "../common/BreadcrumbView";
import FeaturedQuestionsSection from "../home/FeaturedQuestionsSection";
import OpinionsSection from "../home/OpinionsSection";
import QuestionsTable from "../home/QuestionsTable";

export interface ForumPageTemplateProps {
  themes: Theme[];
  questions: Question[];
  opinions: Opinion[];
}

const ForumPageTemplate = ({
  themes = [],
  questions = [],
  opinions = [],
}: ForumPageTemplateProps) => {
  const maxFeaturedQuestions = 70;

  // データ変換関数を使用して型安全に変換
  const featuredQuestions = transformThemesToFeaturedQuestions(
    themes,
    maxFeaturedQuestions
  );
  const latestThemes = transformThemesToLatestThemes(themes);
  const tableQuestions = transformQuestionsToTableItems(questions);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 pt-2">
        <BreadcrumbView items={[{ label: "フォーラム", href: "/forum" }]} />
      </div>

      <HeroSection latestThemes={latestThemes} />

      {/* テーマ一覧セクション */}
      {latestThemes.length > 0 && (
        <div className="mb-12 px-6">
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-wide mb-2">
              お題一覧
            </h2>
            <p className="text-gray-600">
              様々なテーマについて対話を始めることができます
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestThemes.map((theme) => (
              <ThemeCard
                key={theme._id}
                id={theme._id}
                title={theme.title}
                description={theme.description || ""}
                keyQuestionCount={theme.keyQuestionCount || 0}
                commentCount={theme.commentCount || 0}
              />
            ))}
          </div>
        </div>
      )}

      <OpinionsSection opinions={opinions} />

      <FeaturedQuestionsSection questions={featuredQuestions} />

      <QuestionsTable questions={tableQuestions} />
    </div>
  );
};

export default ForumPageTemplate;
