import HeroSection from "../../components/home/HeroSection";
import ThemeCard from "../../components/home/ThemeCard";
import type { Opinion } from "../../types";
import BreadcrumbView from "../common/BreadcrumbView";
import FeaturedQuestionsSection from "../home/FeaturedQuestionsSection";
import OpinionsSection from "../home/OpinionsSection";
import QuestionsTable from "../home/QuestionsTable";

export interface TopPageTemplateProps {
  latestThemes?: {
    _id: string;
    title: string;
    description?: string;
    slug: string;
    keyQuestionCount?: number;
    commentCount?: number;
  }[];
  latestQuestions?: {
    _id: string;
    questionText: string;
    tagLine?: string;
    tags?: string[];
    themeId?: string;
    issueCount?: number;
    solutionCount?: number;
    likeCount?: number;
    uniqueParticipantCount?: number;
    createdAt?: string;
  }[];
  latestOpinions?: Opinion[];
}

const TopPageTemplate = ({
  latestThemes = [],
  latestQuestions = [],
  latestOpinions = [],
}: TopPageTemplateProps) => {
  const maxFeaturedQuestions = 70;
  const featuredQuestions = latestQuestions
    .map((q) => ({
      id: q._id,
      title: q.tagLine || `${q.questionText.substring(0, 50)}...`,
      description: q.questionText,
      participantCount: q.uniqueParticipantCount || 0,
      commentCount: (q.issueCount || 0) + (q.solutionCount || 0),
      likeCount: q.likeCount || 0,
      themeId: q.themeId,
      tags: q.tags || [],
    }))
    .sort(
      (a, b) =>
        (b.participantCount || 0) +
        (b.commentCount || 0) +
        (b.likeCount || 0) -
        (a.participantCount || 0) -
        (a.commentCount || 0) -
        (a.likeCount || 0)
    )
    .slice(0, maxFeaturedQuestions);

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 pt-2">
        <BreadcrumbView items={[]} />
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

      <OpinionsSection opinions={latestOpinions} />

      <FeaturedQuestionsSection questions={featuredQuestions} />

      <QuestionsTable
        questions={latestQuestions.map((q) => ({
          id: q._id,
          category: q.tagLine || "未分類",
          title: q.questionText,
          questionText: q.questionText,
          postCount: (q.issueCount || 0) + (q.solutionCount || 0),
          lastUpdated: q.createdAt || new Date().toISOString(),
          themeId: q.themeId,
          tagLine: q.tagLine,
          description: q.tagLine || `${q.questionText.substring(0, 100)}...`,
          participantCount: q.uniqueParticipantCount || 0,
          commentCount: (q.issueCount || 0) + (q.solutionCount || 0),
        }))}
      />
    </div>
  );
};

export default TopPageTemplate;
