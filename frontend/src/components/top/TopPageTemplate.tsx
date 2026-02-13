import HeroSection from "../../components/home/HeroSection";
import ThemeCard from "../../components/home/ThemeCard";
import BreadcrumbView from "../common/BreadcrumbView";

export interface TopPageTemplateProps {
  latestThemes?: {
    _id: string;
    title: string;
    description?: string;
    slug: string;
    keyQuestionCount?: number;
    commentCount?: number;
  }[];
}

const TopPageTemplate = ({ latestThemes = [] }: TopPageTemplateProps) => {
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
    </div>
  );
};

export default TopPageTemplate;
