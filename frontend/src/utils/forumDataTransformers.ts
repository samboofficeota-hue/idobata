import type { Question, Theme } from "../types";

// テーマを注目のお題形式に変換
export const transformThemeToFeaturedQuestion = (theme: Theme) => ({
  id: theme._id,
  title: theme.title,
  description: theme.description || "",
  participantCount: 0, // テーマには参加人数の概念がないため0
  commentCount: theme.commentCount || 0,
  likeCount: 0, // テーマにはいいね数の概念がないため0
  themeId: theme._id,
  tags: [theme.slug], // スラッグをタグとして使用
});

// テーマをフロントエンド用の形式に変換
export const transformThemeToLatestTheme = (theme: Theme) => ({
  _id: theme._id,
  title: theme.title,
  description: theme.description || "",
  slug: theme.slug,
  keyQuestionCount: theme.keyQuestionCount || 0,
  commentCount: theme.commentCount || 0,
});

// 質問をQuestionsTable用の形式に変換
export const transformQuestionToTableItem = (question: Question) => ({
  id: question._id,
  category: question.tagLine || "未分類",
  title: question.questionText,
  questionText: question.questionText,
  postCount: (question.issueCount || 0) + (question.solutionCount || 0),
  lastUpdated: question.createdAt || new Date().toISOString(),
  themeId: question.themeId,
  tagLine: question.tagLine,
  description:
    question.tagLine || `${question.questionText.substring(0, 100)}...`,
  participantCount: question.uniqueParticipantCount || 0,
  commentCount: (question.issueCount || 0) + (question.solutionCount || 0),
});

// テーマ配列を注目のお題配列に変換
export const transformThemesToFeaturedQuestions = (
  themes: Theme[],
  maxCount = 70
) => {
  return themes
    .map(transformThemeToFeaturedQuestion)
    .sort(
      (a, b) =>
        (b.participantCount || 0) +
        (b.commentCount || 0) +
        (b.likeCount || 0) -
        (a.participantCount || 0) -
        (a.commentCount || 0) -
        (a.likeCount || 0)
    )
    .slice(0, maxCount);
};

// テーマ配列をフロントエンド用の形式に変換
export const transformThemesToLatestThemes = (themes: Theme[]) => {
  return themes.map(transformThemeToLatestTheme);
};

// 質問配列をQuestionsTable用の形式に変換
export const transformQuestionsToTableItems = (questions: Question[]) => {
  return questions.map(transformQuestionToTableItem);
};
