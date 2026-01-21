import React, { useState, useEffect } from "react";
import type { ChangeEvent, FC, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../services/api/apiClient";
import { ApiErrorType } from "../../services/api/apiError";
import type {
  CreateThemePayload,
  Problem,
  Question,
  Theme,
  UpdateThemePayload,
} from "../../services/api/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ReportModal } from "./ReportModal";

interface ThemeFormProps {
  theme?: Theme;
  isEdit?: boolean;
}

const ThemeForm: FC<ThemeFormProps> = ({ theme, isEdit = false }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<
    CreateThemePayload | UpdateThemePayload
  >({
    title: "",
    description: "",
    slug: "",
    isActive: true,
    customPrompt: "",
    disableNewComment: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isGeneratingReports, setIsGeneratingReports] = useState<
    Record<string, boolean>
  >({});
  const [isGeneratingDebateAnalysis, setIsGeneratingDebateAnalysis] = useState<
    Record<string, boolean>
  >({});
  const [isGeneratingVisualReport, setIsGeneratingVisualReport] =
    useState(false);
  const [isGeneratingBulkVisualReports, setIsGeneratingBulkVisualReports] =
    useState(false);
  const [isGeneratingBulkDebateAnalysis, setIsGeneratingBulkDebateAnalysis] =
    useState(false);
  const [isGeneratingBulkReports, setIsGeneratingBulkReports] = useState(false);

  // 一括生成の進捗管理
  const [bulkProgress, setBulkProgress] = useState<{
    visual: { completed: number; total: number };
    debate: { completed: number; total: number };
    reports: { completed: number; total: number };
  }>({
    visual: { completed: 0, total: 0 },
    debate: { completed: 0, total: 0 },
    reports: { completed: 0, total: 0 },
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // 表示/非表示の状態管理
  const [questionVisibility, setQuestionVisibility] = useState<
    Record<string, boolean>
  >({});

  // レポートモーダルの状態管理
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    type: "visual" | "debate" | "report";
    data: unknown;
    questionText: string;
  }>({
    isOpen: false,
    type: "visual",
    data: null,
    questionText: "",
  });

  useEffect(() => {
    if (isEdit && theme) {
      setFormData({
        title: theme.title,
        description: theme.description || "",
        slug: theme.slug,
        isActive: theme.isActive,
        customPrompt: theme.customPrompt || "",
        disableNewComment: theme.disableNewComment || false,
      });
    }
  }, [isEdit, theme]);

  // レポートモーダルの状態を監視
  useEffect(() => {
    console.log(`[ThemeForm] reportModal state changed:`, reportModal);
  }, [reportModal]);

  useEffect(() => {
    if (isEdit && theme?._id) {
      fetchQuestions(theme._id);
    }
  }, [isEdit, theme?._id]);

  const fetchQuestions = async (themeId: string) => {
    setIsLoadingQuestions(true);
    setQuestionsError(null);

    const result = await apiClient.getQuestionsByTheme(themeId);

    if (result.isErr()) {
      console.error("Failed to fetch questions:", result.error);
      setQuestionsError("シャープな問いの読み込みに失敗しました。");
      setIsLoadingQuestions(false);
      return;
    }

    setQuestions(result.value);

    // 表示/非表示の状態を初期化
    const visibilityState: Record<string, boolean> = {};
    for (const question of result.value) {
      visibilityState[question._id] = question.isVisible ?? true;
    }
    setQuestionVisibility(visibilityState);

    setIsLoadingQuestions(false);
  };

  const handleGenerateQuestions = async () => {
    if (!theme?._id) return;

    setIsGeneratingQuestions(true);
    setQuestionsError(null);
    setSuccessMessage(null);

    const result = await apiClient.generateQuestions(theme._id);

    if (result.isErr()) {
      console.error("Failed to generate questions:", result.error);
      setQuestionsError("シャープな問いの生成に失敗しました。");
      setIsGeneratingQuestions(false);
      return;
    }

    setSuccessMessage(
      "シャープな問いの生成を開始しました。しばらくすると問いリストに表示されます。"
    );

    // ポーリングで問いの生成完了を待つ
    const pollForQuestions = async () => {
      let attempts = 0;
      const maxAttempts = 12; // 最大2分間（10秒間隔で12回）

      const poll = async () => {
        attempts++;
        console.log(`問い生成の確認中... (${attempts}/${maxAttempts})`);

        const result = await apiClient.getQuestionsByTheme(theme._id);
        if (result.isOk() && result.value.length > 0) {
          console.log(`${result.value.length}個の問いが生成されました`);
          setQuestions(result.value);
          setSuccessMessage(null);
          setIsGeneratingQuestions(false);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // 10秒後に再試行
        } else {
          console.log("問い生成のタイムアウト");
          setSuccessMessage(
            "問いの生成に時間がかかっています。しばらく後にページを更新してください。"
          );
          setIsGeneratingQuestions(false);
        }
      };

      setTimeout(poll, 5000); // 5秒後に開始
    };

    pollForQuestions();
  };

  const handleGenerateVisualReport = async () => {
    if (!theme?._id || !selectedQuestionId) return;

    setIsGeneratingVisualReport(true);
    setQuestionsError(null);
    setSuccessMessage(null);

    const result = await apiClient.generateVisualReport(
      theme._id,
      selectedQuestionId
    );

    if (result.isErr()) {
      console.error("Failed to generate visual report:", result.error);
      setQuestionsError("ビジュアルレポートの生成に失敗しました。");
      setIsGeneratingVisualReport(false);
      return;
    }

    setSuccessMessage(
      "ビジュアルレポートの生成を開始しました。しばらくすると問いの詳細画面で確認できます。"
    );

    setIsGeneratingVisualReport(false);
  };

  const handleGenerateReport = async (
    questionId: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }

    if (!theme?._id) return;

    setIsGeneratingReports((prev) => ({ ...prev, [questionId]: true }));
    setQuestionsError(null);
    setSuccessMessage(null);

    const result = await apiClient.generateDigestDraft(theme._id, questionId);

    if (result.isErr()) {
      console.error("Failed to generate report:", result.error);
      setQuestionsError("意見まとめの生成に失敗しました。");
      setIsGeneratingReports((prev) => ({ ...prev, [questionId]: false }));
      return;
    }

    setSuccessMessage(
      "意見まとめの生成を開始しました。生成には数分かかる場合があります。"
    );
    setIsGeneratingReports((prev) => ({ ...prev, [questionId]: false }));
  };

  const handleGenerateDebateAnalysis = async (
    questionId: string,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.stopPropagation();
    }

    if (!theme?._id) return;

    setIsGeneratingDebateAnalysis((prev) => ({ ...prev, [questionId]: true }));
    setQuestionsError(null);
    setSuccessMessage(null);

    const result = await apiClient.generateDebateAnalysis(
      theme._id,
      questionId
    );

    if (result.isErr()) {
      console.error("Failed to generate debate analysis:", result.error);
      setQuestionsError("議論分析の生成に失敗しました。");
      setIsGeneratingDebateAnalysis((prev) => ({
        ...prev,
        [questionId]: false,
      }));
      return;
    }

    setSuccessMessage(
      "議論分析の生成を開始しました。生成には数分かかる場合があります。"
    );
    setIsGeneratingDebateAnalysis((prev) => ({
      ...prev,
      [questionId]: false,
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 表示/非表示の切り替えハンドラー
  const handleToggleVisibility = async (questionId: string) => {
    if (!theme?._id) return;

    const currentVisibility = questionVisibility[questionId] ?? true;
    const newVisibility = !currentVisibility;

    try {
      // バックエンドに表示/非表示の状態を送信
      await apiClient.updateQuestionVisibility(
        theme._id,
        questionId,
        newVisibility
      );

      // ローカル状態を更新
      setQuestionVisibility((prev) => ({
        ...prev,
        [questionId]: newVisibility,
      }));

      setSuccessMessage(
        `問いを${newVisibility ? "表示" : "非表示"}に設定しました。`
      );
    } catch (error) {
      console.error("Failed to update question visibility:", error);
      setQuestionsError("表示/非表示の更新に失敗しました。");
    }
  };

  // 進捗表示用のヘルパー関数
  const getProgressText = (type: "visual" | "debate" | "reports") => {
    const progress = bulkProgress[type];
    if (progress.total === 0) return "";
    return `${progress.completed}/${progress.total}`;
  };

  const getProgressPercentage = (type: "visual" | "debate" | "reports") => {
    const progress = bulkProgress[type];
    if (progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  };

  // 一括生成ハンドラー（進捗表示付き）
  const handleBulkGenerateVisualReports = async () => {
    if (!theme?._id || questions.length === 0) return;

    setIsGeneratingBulkVisualReports(true);
    setQuestionsError(null);
    setSuccessMessage(null);

    // 進捗初期化
    setBulkProgress((prev) => ({
      ...prev,
      visual: { completed: 0, total: questions.length },
    }));

    try {
      // 各レポートを順次生成して進捗を更新
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        try {
          await apiClient.generateVisualReport(theme._id, question._id);

          // 進捗更新
          setBulkProgress((prev) => ({
            ...prev,
            visual: { completed: i + 1, total: questions.length },
          }));

          // 少し待機（UIの更新を確認するため）
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `Failed to generate visual report for question ${question._id}:`,
            error
          );
        }
      }

      setSuccessMessage(
        `イラストまとめの一括生成が完了しました。${questions.length}個のレポートを生成しました。`
      );
    } catch (error) {
      console.error("Failed to generate visual reports:", error);
      setQuestionsError("イラストまとめの一括生成に失敗しました。");
    }

    setIsGeneratingBulkVisualReports(false);
  };

  const handleBulkGenerateDebateAnalysis = async () => {
    if (!theme?._id || questions.length === 0) return;

    setIsGeneratingBulkDebateAnalysis(true);
    setQuestionsError(null);
    setSuccessMessage(null);

    // 進捗初期化
    setBulkProgress((prev) => ({
      ...prev,
      debate: { completed: 0, total: questions.length },
    }));

    try {
      // 各レポートを順次生成して進捗を更新
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        try {
          await apiClient.generateDebateAnalysis(theme._id, question._id);

          // 進捗更新
          setBulkProgress((prev) => ({
            ...prev,
            debate: { completed: i + 1, total: questions.length },
          }));

          // 少し待機（UIの更新を確認するため）
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `Failed to generate debate analysis for question ${question._id}:`,
            error
          );
        }
      }

      setSuccessMessage(
        `論点まとめの一括生成が完了しました。${questions.length}個のレポートを生成しました。`
      );
    } catch (error) {
      console.error("Failed to generate debate analysis:", error);
      setQuestionsError("論点まとめの一括生成に失敗しました。");
    }

    setIsGeneratingBulkDebateAnalysis(false);
  };

  const handleBulkGenerateReports = async () => {
    if (!theme?._id || questions.length === 0) return;

    setIsGeneratingBulkReports(true);
    setQuestionsError(null);
    setSuccessMessage(null);

    // 進捗初期化
    setBulkProgress((prev) => ({
      ...prev,
      reports: { completed: 0, total: questions.length },
    }));

    try {
      // 各レポートを順次生成して進捗を更新
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        try {
          await apiClient.generateDigestDraft(theme._id, question._id);

          // 進捗更新
          setBulkProgress((prev) => ({
            ...prev,
            reports: { completed: i + 1, total: questions.length },
          }));

          // 少し待機（UIの更新を確認するため）
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `Failed to generate report for question ${question._id}:`,
            error
          );
        }
      }

      setSuccessMessage(
        `意見まとめの一括生成が完了しました。${questions.length}個の意見まとめを生成しました。`
      );
    } catch (error) {
      console.error("Failed to generate reports:", error);
      setQuestionsError("意見まとめの一括生成に失敗しました。");
    }

    setIsGeneratingBulkReports(false);
  };

  // レポート表示ハンドラー
  const handleViewVisualReport = async (questionId: string) => {
    if (!theme?._id) return;

    try {
      const result = await apiClient.getVisualReport(theme._id, questionId);
      if (result.isOk()) {
        const question = questions.find((q) => q._id === questionId);
        setReportModal({
          isOpen: true,
          type: "visual",
          data: result.value,
          questionText: question?.questionText || "",
        });
      } else {
        setQuestionsError("レポートが見つかりません。");
      }
    } catch (error) {
      console.error("Failed to get visual report:", error);
      setQuestionsError("レポートの取得に失敗しました。");
    }
  };

  const handleViewDebateAnalysis = async (questionId: string) => {
    if (!theme?._id) return;

    try {
      const result = await apiClient.getDebateAnalysis(theme._id, questionId);
      if (result.isOk()) {
        const question = questions.find((q) => q._id === questionId);
        setReportModal({
          isOpen: true,
          type: "debate",
          data: result.value,
          questionText: question?.questionText || "",
        });
      } else {
        setQuestionsError("レポートが見つかりません。");
      }
    } catch (error) {
      console.error("Failed to get debate analysis:", error);
      setQuestionsError("レポートの取得に失敗しました。");
    }
  };

  const handleViewReport = async (questionId: string) => {
    if (!theme?._id) return;

    try {
      console.log(`[handleViewReport] Fetching digest draft for questionId: ${questionId}, themeId: ${theme._id}`);
      const result = await apiClient.getDigestDraft(theme._id, questionId);
      console.log(`[handleViewReport] API result:`, result);
      
      if (result.isOk() && result.value.length > 0) {
        const question = questions.find((q) => q._id === questionId);
        // 最新のDigestDraftを取得
        const latestDigest = result.value[0];
        console.log(`[handleViewReport] Latest digest:`, latestDigest);
        
        const modalState = {
          isOpen: true,
          type: "report" as const,
          data: latestDigest,
          questionText: question?.questionText || "",
        };
        console.log(`[handleViewReport] Setting modal state:`, modalState);
        
        setReportModal(modalState);
        
        // 状態更新後の確認
        setTimeout(() => {
          console.log(`[handleViewReport] Modal state after update:`, reportModal);
        }, 100);
      } else {
        console.warn(`[handleViewReport] No digest drafts found. Result:`, result);
        setQuestionsError("意見まとめが見つかりません。");
      }
    } catch (error) {
      console.error("Failed to get report:", error);
      setQuestionsError("レポートの取得に失敗しました。");
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title) {
      newErrors.title = "タイトルは必須です";
    }

    if (!formData.slug) {
      newErrors.slug = "スラッグは必須です";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug as string)) {
      newErrors.slug = "スラッグは小文字、数字、ハイフンのみ使用できます";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    if (isEdit && theme) {
      const result = await apiClient.updateTheme(theme._id, formData);

      result.match(
        () => {
          navigate("/themes");
        },
        (error) => {
          console.error("Form submission error:", error);

          if (error.type === ApiErrorType.VALIDATION_ERROR) {
            setErrors({ form: error.message });
          } else {
            alert(`エラーが発生しました: ${error.message}`);
          }
        }
      );
    } else {
      const result = await apiClient.createTheme(
        formData as CreateThemePayload
      );

      result.match(
        () => {
          navigate("/themes");
        },
        (error) => {
          console.error("Form submission error:", error);

          if (error.type === ApiErrorType.VALIDATION_ERROR) {
            setErrors({ form: error.message });
          } else {
            alert(`エラーが発生しました: ${error.message}`);
          }
        }
      );
    }

    setIsSubmitting(false);
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-8xl">
      {errors.form && (
        <div className="bg-destructive/20 text-destructive-foreground p-4 rounded mb-4">
          {errors.form}
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="title"
          className="block text-foreground font-medium mb-2"
        >
          タイトル
          <span className="text-destructive ml-1">*</span>
        </label>
        <Input
          id="title"
          name="title"
          value={formData.title as string}
          onChange={handleChange}
          className={errors.title ? "border-destructive" : ""}
        />
        {errors.title && (
          <p className="text-destructive text-sm mt-1">{errors.title}</p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="description"
          className="block text-foreground font-medium mb-2"
        >
          説明
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
          rows={4}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="slug"
          className="block text-foreground font-medium mb-2"
        >
          スラッグ
          <span className="text-destructive ml-1">*</span>
        </label>
        <Input
          id="slug"
          name="slug"
          value={formData.slug as string}
          onChange={handleChange}
          className={errors.slug ? "border-destructive" : ""}
          placeholder="例: my-theme-slug"
        />
        {errors.slug && (
          <p className="text-destructive text-sm mt-1">{errors.slug}</p>
        )}
      </div>

      <div className="mb-4 flex items-center">
        <input
          type="checkbox"
          id="isActive"
          name="isActive"
          checked={formData.isActive as boolean}
          onChange={handleChange}
          className="mr-2"
        />
        <label htmlFor="isActive" className="text-foreground">
          アクティブ
        </label>
      </div>

      <div className="mb-4">
        <label
          htmlFor="customPrompt"
          className="block text-foreground font-medium mb-2"
        >
          AI プロンプト
          <span className="text-muted-foreground ml-1 text-sm">(省略可)</span>
        </label>
        <textarea
          id="customPrompt"
          name="customPrompt"
          value={(formData.customPrompt as string) || ""}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
          rows={8}
        />
      </div>

      <div className="mb-4 flex items-center">
        <input
          type="checkbox"
          id="disableNewComment"
          name="disableNewComment"
          checked={formData.disableNewComment as boolean}
          onChange={handleChange}
          className="mr-2"
        />
        <label htmlFor="disableNewComment" className="text-foreground">
          新規コメントを無効化
        </label>
      </div>

      <div className="flex space-x-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送信中..." : isEdit ? "更新" : "作成"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate("/themes")}
        >
          キャンセル
        </Button>
      </div>

      {/* Sharp Questions Section - Only show in edit mode */}
      {isEdit && theme?._id && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            このテーマに紐づくシャープな問い
          </h2>

          {questionsError && (
            <div className="mb-4 p-4 bg-destructive/20 border border-destructive/30 rounded-lg text-destructive-foreground text-sm">
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-label="エラーアイコン"
                  role="img"
                >
                  <title>エラーアイコン</title>
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {questionsError}
              </p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-4 bg-success/80 border border-success/90 rounded-lg text-success-foreground text-sm">
              <p className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-label="成功アイコン"
                  role="img"
                >
                  <title>成功アイコン</title>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {successMessage}
              </p>
            </div>
          )}

          {/* Generation Button */}
          <div className="mb-6 p-4 bg-background rounded-lg border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-primary-dark mb-1">
                  シャープな問い生成
                </h3>
                <p className="text-sm text-muted-foreground">
                  課題データから新しいシャープな問いを生成します
                </p>
              </div>
              <button
                onClick={handleGenerateQuestions}
                disabled={isGeneratingQuestions}
                className="btn bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm whitespace-nowrap hover:bg-primary/90"
                type="button"
              >
                {isGeneratingQuestions ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-label="読み込み中"
                      role="img"
                    >
                      <title>読み込み中</title>
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    生成中...
                  </span>
                ) : questions.length === 0 ? (
                  "生成する"
                ) : (
                  "さらに生成する"
                )}
              </button>
            </div>
          </div>

          {/* Questions List */}
          <div className="bg-background p-4 rounded-lg border border-border shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-primary-dark">
              シャープな問い一覧 ({questions.length})
            </h3>
            {isLoadingQuestions ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-pulse-slow flex space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
              </div>
            ) : questions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/3"
                      >
                        見出し
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/3"
                      >
                        問い
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/6"
                      >
                        関連するproblem
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/12"
                      >
                        作成日時
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/12"
                      >
                        表示/非表示
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        <div className="flex flex-col space-y-2">
                          <span>イラストまとめ</span>
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => handleBulkGenerateVisualReports()}
                              disabled={isGeneratingBulkVisualReports}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
                              type="button"
                            >
                              {isGeneratingBulkVisualReports
                                ? "生成中..."
                                : "一括作成"}
                            </button>
                            {isGeneratingBulkVisualReports && (
                              <div className="text-xs text-muted-foreground">
                                <div className="flex justify-between items-center mb-1">
                                  <span>進捗: {getProgressText("visual")}</span>
                                  <span>
                                    {getProgressPercentage("visual")}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${getProgressPercentage("visual")}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        <div className="flex flex-col space-y-2">
                          <span>論点まとめ</span>
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => handleBulkGenerateDebateAnalysis()}
                              disabled={isGeneratingBulkDebateAnalysis}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
                              type="button"
                            >
                              {isGeneratingBulkDebateAnalysis
                                ? "生成中..."
                                : "一括作成"}
                            </button>
                            {isGeneratingBulkDebateAnalysis && (
                              <div className="text-xs text-muted-foreground">
                                <div className="flex justify-between items-center mb-1">
                                  <span>進捗: {getProgressText("debate")}</span>
                                  <span>
                                    {getProgressPercentage("debate")}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${getProgressPercentage("debate")}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      >
                        <div className="flex flex-col space-y-2">
                          <span>市民意見レポート</span>
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => handleBulkGenerateReports()}
                              disabled={isGeneratingBulkReports}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
                              type="button"
                            >
                              {isGeneratingBulkReports
                                ? "生成中..."
                                : "一括作成"}
                            </button>
                            {isGeneratingBulkReports && (
                              <div className="text-xs text-muted-foreground">
                                <div className="flex justify-between items-center mb-1">
                                  <span>
                                    進捗: {getProgressText("reports")}
                                  </span>
                                  <span>
                                    {getProgressPercentage("reports")}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${getProgressPercentage("reports")}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {questions.map((question) => (
                      <tr
                        key={question._id}
                        className={`hover:bg-muted/50 cursor-pointer ${selectedQuestionId === question._id ? "bg-muted/30" : ""}`}
                        onClick={() => setSelectedQuestionId(question._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedQuestionId(question._id);
                          }
                        }}
                        tabIndex={0}
                        aria-selected={selectedQuestionId === question._id}
                      >
                        <td className="px-6 py-4 whitespace-normal text-sm text-foreground font-medium">
                          {question.tagLine}
                        </td>
                        <td className="px-6 py-4 whitespace-normal text-sm text-foreground">
                          {question.questionText}
                          {question.tags && question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {question.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="border bg-primary-100 text-primary-800 rounded-full px-2 py-0.5 text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-normal text-sm text-muted-foreground">
                          {/* We would fetch related problems here in a real implementation */}
                          <span className="text-muted-foreground italic">
                            関連データは取得中...
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(question.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleVisibility(question._id);
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              (questionVisibility[question._id] ?? true)
                                ? "bg-success/20 text-success-foreground"
                                : "bg-destructive/20 text-destructive-foreground"
                            }`}
                            type="button"
                          >
                            {(questionVisibility[question._id] ?? true)
                              ? "表示中"
                              : "非表示"}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewVisualReport(question._id);
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                              type="button"
                            >
                              レポートを見る
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQuestionId(question._id);
                                handleGenerateVisualReport();
                              }}
                              disabled={isGeneratingVisualReport}
                              className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                              type="button"
                            >
                              {isGeneratingVisualReport &&
                              selectedQuestionId === question._id
                                ? "生成中..."
                                : "更新する"}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDebateAnalysis(question._id);
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                              type="button"
                            >
                              レポートを見る
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateDebateAnalysis(question._id, e);
                              }}
                              disabled={
                                isGeneratingDebateAnalysis[question._id]
                              }
                              className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                              type="button"
                            >
                              {isGeneratingDebateAnalysis[question._id]
                                ? "生成中..."
                                : "更新する"}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewReport(question._id);
                              }}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                              type="button"
                            >
                              レポートを見る
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateReport(question._id, e);
                              }}
                              disabled={isGeneratingReports[question._id]}
                              className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
                              type="button"
                            >
                              {isGeneratingReports[question._id]
                                ? "生成中..."
                                : "更新する"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                <p>まだ問いが生成されていません</p>
                <p className="mt-2 text-xs">
                  上部の「生成する」ボタンから生成できます
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </form>

    {/* レポートモーダル - formタグの外に配置 */}
    <ReportModal
      isOpen={reportModal.isOpen}
      onClose={() => setReportModal((prev) => ({ ...prev, isOpen: false }))}
      reportType={reportModal.type}
      reportData={reportModal.data as any}
      questionText={reportModal.questionText}
    />
  </>
  );
};

export default ThemeForm;
