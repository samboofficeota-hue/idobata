import { Lightbulb, SquareChartGantt } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FloatingChat, type FloatingChatRef } from "../components/chat";
import BreadcrumbView from "../components/common/BreadcrumbView";
import DebatePointsContent from "../components/question/DebatePointsContent";
import IllustrationReportCard from "../components/question/IllustrationReportCard";
import IllustrationSummaryContent from "../components/question/IllustrationSummaryContent";
import OpinionSummaryContent from "../components/question/OpinionSummaryContent";
import OtherOpinionCard from "../components/question/OtherOpinionCard";
import ReportCard from "../components/question/ReportCard";
import ThemePromptSection from "../components/question/ThemePromptSection";
import { DownloadButton } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useQuestionDetail } from "../hooks/useQuestionDetail";
import { useThemeDetail } from "../hooks/useThemeDetail";
import { QuestionChatManager } from "../services/chatManagers/QuestionChatManager";
import { socketClient } from "../services/socket/socketClient";
import type { NewExtractionEvent } from "../services/socket/socketClient";
import { ExtendedExtractionData, MessageType } from "../types";

const QuestionDetail = () => {
  const { themeId, qId } = useParams<{ themeId: string; qId: string }>();
  const { user } = useAuth();
  const chatRef = useRef<FloatingChatRef>(null);
  const [isOpinionsExpanded, setIsOpinionsExpanded] = useState(false);
  const [chatManager, setChatManager] = useState<QuestionChatManager | null>(
    null
  );

  const { questionDetail, isLoading, error } = useQuestionDetail(
    themeId || "",
    qId || ""
  );
  const [opinions, setOpinions] = useState<{
    issues: Array<{ id: string; text: string; relevance: number }>;
    solutions: Array<{ id: string; text: string; relevance: number }>;
  }>({ issues: [], solutions: [] });
  const { themeDetail: themeInfo } = useThemeDetail(themeId || "");

  const isCommentDisabled = themeInfo?.theme?.disableNewComment === true;

  // Chat manager effect - separate from page updates
  useEffect(() => {
    if (themeId && qId && user?.id && questionDetail?.question?.questionText) {
      console.log("Creating new ChatManager");
      const questionText = questionDetail?.question?.questionText || "";

      const manager = new QuestionChatManager({
        themeId,
        questionId: qId,
        questionText,
        userId: user.id,
        onNewMessage: (message) => {
          let messageType: MessageType = "system";
          if (message.constructor.name === "UserMessage") {
            messageType = "user";
          } else if (message.constructor.name === "SystemNotification") {
            messageType = "system-message";
          }
          chatRef.current?.addMessage(message.content, messageType);
        },
        onNewExtraction: () => {
          // Chat manager handles notifications only
          // Page updates are handled separately
        },
      });

      setChatManager(manager);

      return () => {
        console.log("Cleaning up ChatManager");
        manager.cleanup();
      };
    }
  }, [themeId, qId, questionDetail, user?.id]);

  // Separate effect for page updates via WebSocket
  useEffect(() => {
    if (!themeId) return;

    console.log("Setting up WebSocket subscription for page updates");

    // Subscribe to theme for real-time updates
    socketClient.subscribeToTheme(themeId);

    // Handle new extractions for page updates
    const handleNewExtraction = (extraction: NewExtractionEvent) => {
      console.log("Page update - New extraction received:", extraction);
      const { type, data } = extraction;

      if (type === "problem") {
        setOpinions((prev) => {
          const exists = prev.issues.some((issue) => issue.id === data._id);
          if (exists) {
            console.log("Problem already exists, skipping:", data._id);
            return prev;
          }
          console.log("Adding new problem to page:", data._id);
          return {
            ...prev,
            issues: [
              ...prev.issues,
              {
                id: data._id,
                text: data.statement,
                relevance:
                  Math.round(
                    (data as ExtendedExtractionData).relevanceScore * 100
                  ) || 0,
              },
            ],
          };
        });
      } else if (type === "solution") {
        setOpinions((prev) => {
          const exists = prev.solutions.some(
            (solution) => solution.id === data._id
          );
          if (exists) {
            console.log("Solution already exists, skipping:", data._id);
            return prev;
          }
          console.log("Adding new solution to page:", data._id);
          return {
            ...prev,
            solutions: [
              ...prev.solutions,
              {
                id: data._id,
                text: data.statement,
                relevance:
                  Math.round(
                    (data as ExtendedExtractionData).relevanceScore * 100
                  ) || 0,
              },
            ],
          };
        });
      }
    };

    const unsubscribeNewExtraction =
      socketClient.onNewExtraction(handleNewExtraction);

    return () => {
      console.log("Cleaning up page WebSocket subscription");
      unsubscribeNewExtraction();
      socketClient.unsubscribeFromTheme(themeId);
    };
  }, [themeId]);

  // Separate useEffect for initializing opinions from questionDetail
  useEffect(() => {
    if (
      questionDetail &&
      opinions.issues.length === 0 &&
      opinions.solutions.length === 0
    ) {
      const initialOpinions = {
        issues:
          questionDetail?.relatedProblems?.map((p) => ({
            id: p._id,
            text: p.statement,
            relevance: Math.round(p.relevanceScore * 100) || 0,
          })) ?? [],
        solutions:
          questionDetail?.relatedSolutions?.map((s) => ({
            id: s._id,
            text: s.statement,
            relevance: Math.round(s.relevanceScore * 100) || 0,
          })) ?? [],
      };
      setOpinions(initialOpinions);
    }
  }, [questionDetail, opinions.issues.length, opinions.solutions.length]);

  const handleSendMessage = (message: string) => {
    if (chatManager) {
      chatManager.addMessage(message, "user");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <p>質問の詳細を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (questionDetail) {
    const questionData = {
      id: questionDetail?.question?._id ?? "",
      question: questionDetail?.question?.questionText ?? "",
      tagLine: questionDetail?.question?.tagLine ?? "",
      tags: questionDetail?.question?.tags ?? [],
      voteCount: questionDetail?.question?.voteCount ?? 0,
    };

    const themeData = {
      id: themeId || "",
      title: themeInfo?.theme?.title || "テーマ",
    };

    // This is now handled by the separate useEffect above

    const breadcrumbItems = [
      {
        label: themeData.title,
        href: `/themes/${themeId}`,
      },
      {
        label: questionData.tagLine || questionData.question,
        href: `/themes/${themeId}/questions/${qId}`,
      },
    ];

    return (
      <>
        <div className="xl:mr-[480px]">
          <div className="px-6">
            <BreadcrumbView items={breadcrumbItems} />
          </div>
          <div className="px-6 py-8">
            <ThemePromptSection
              themeTitle={themeData.title}
              themeDescription={questionData.question}
              themeTags={questionData.tags}
              participantCount={questionDetail?.participantCount || 0}
              dialogueCount={questionDetail?.dialogueCount || 0}
            />
          </div>

          {/* ほかの人の意見セクション */}
          <div className="mb-8 px-6">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-2 md:gap-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                    <Lightbulb className="w-8 h-8 text-orange-400 stroke-2" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-wide">
                    みんなの意見
                  </h2>
                </div>
                <div className="flex justify-end md:justify-start items-center gap-4 flex-wrap">
                  <div className="flex items-center justify-center gap-1 px-0 py-0">
                    <span className="text-xs text-blue-500 font-normal leading-8 tracking-wide">
                      対話参加人数
                    </span>
                    <span className="text-xl font-bold text-gray-800 leading-8 tracking-wide">
                      {questionDetail?.participantCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1 px-0 py-0">
                    <span className="text-xs text-green-500 font-normal leading-8 tracking-wide">
                      対話数
                    </span>
                    <span className="text-xl font-bold text-gray-800 leading-8 tracking-wide">
                      {opinions.issues.length + opinions.solutions.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              // 課題と対策を統合して新しい順に並べる
              const allOpinions = [
                ...opinions.issues.map((issue, index) => ({
                  id: issue.id,
                  text: issue.text,
                  relevance: issue.relevance,
                  userName: `ユーザー${index + 1}`,
                  userIconColor: ["red", "blue", "yellow", "green"][
                    index % 4
                  ] as "red" | "blue" | "yellow" | "green",
                  debatePoint: index % 2 === 0 ? "短期利益" : "長期成長",
                })),
                ...opinions.solutions.map((solution, index) => ({
                  id: solution.id,
                  text: solution.text,
                  relevance: solution.relevance,
                  userName: `ユーザー${index + opinions.issues.length + 1}`,
                  userIconColor: ["red", "blue", "yellow", "green"][
                    (index + opinions.issues.length) % 4
                  ] as "red" | "blue" | "yellow" | "green",
                  debatePoint:
                    (index + opinions.issues.length) % 2 === 0
                      ? "短期利益"
                      : "長期成長",
                })),
              ];

              // 関連度の高い順にソートして表示数を決定
              const displayedOpinions = allOpinions
                .sort((a, b) => b.relevance - a.relevance)
                .slice(0, isOpinionsExpanded ? allOpinions.length : 4);

              return (
                <>
                  <div
                    className={`bg-gray-100 rounded-xl p-3 relative ${isOpinionsExpanded ? "" : "max-h-[200px] overflow-hidden"}`}
                  >
                    <div className="flex flex-col md:flex-row md:flex-wrap gap-4 pt-3">
                      {displayedOpinions.map((opinion) => (
                        <OtherOpinionCard
                          key={opinion.id}
                          text={opinion.text}
                          userName={opinion.userName}
                          userIconColor={opinion.userIconColor}
                          debatePoint={opinion.debatePoint}
                        />
                      ))}
                    </div>

                    {/* グラデーションオーバーレイ - 展開時は非表示 */}
                    {!isOpinionsExpanded && allOpinions.length > 4 && (
                      <div className="absolute bottom-0 left-0 w-full h-[100px] bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />
                    )}

                    {/* スクロールバー - 展開時は非表示 */}
                    {!isOpinionsExpanded && allOpinions.length > 4 && (
                      <div className="absolute top-1 right-0 w-2.5 h-[106px] bg-black/16 rounded-full" />
                    )}
                  </div>

                  {/* 展開/折りたたみボタン - コンテナの外に配置 */}
                  {allOpinions.length > 4 && (
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setIsOpinionsExpanded(!isOpinionsExpanded)
                        }
                        className="px-6 py-3 text-base font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                      >
                        {isOpinionsExpanded
                          ? "折りたたむ"
                          : `もっと見る (${allOpinions.length - 4}件)`}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* 生成されたレポートセクション */}
          <div className="mb-8 px-6">
            {/* ヘッダー */}
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <SquareChartGantt className="w-8 h-8 text-blue-400 stroke-2" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-wide">
                    生成されたレポート
                  </h2>
                </div>
                <DownloadButton downloadType="pdf" data={questionDetail}>
                  すべてダウンロード
                </DownloadButton>
              </div>
            </div>

            {/* 論点まとめカード */}
            <ReportCard
              title="論点まとめ"
              downloadButtonText="PDFダウンロード"
              isEmpty={!questionDetail?.debateData}
              emptyDescription="多くの対話が集まると、論点をまとめたレポートが表示されるようになります。"
              downloadData={questionDetail?.debateData}
            >
              <DebatePointsContent debateData={questionDetail?.debateData} />
            </ReportCard>

            {/* 意見まとめカード */}
            <ReportCard
              title="意見まとめ"
              downloadButtonText="PDFダウンロード"
              isEmpty={
                !questionDetail?.reportExample ||
                questionDetail?.reportExample?.issues?.length === 0
              }
              emptyDescription="多くの対話が集まると、意見をまとめたレポートが表示されるようになります。"
              downloadData={questionDetail?.reportExample}
            >
              <OpinionSummaryContent
                reportExample={
                  questionDetail?.reportExample ?? {
                    introduction:
                      "レポート例はまだ作成されていません。より多くの意見が集まるとレポート例が表示されるようになります。",
                    issues: [],
                  }
                }
              />
            </ReportCard>

            {/* イラスト要約カード */}
            <IllustrationReportCard
              title="イラスト要約"
              downloadButtonText="画像ダウンロード"
              isEmpty={!questionDetail?.visualReport}
              emptyDescription="多くの対話が集まると、意見をまとめたイラストが表示されるようになります。"
              downloadData={{ imageUrl: questionDetail?.visualReport }}
            >
              <IllustrationSummaryContent
                visualReport={questionDetail?.visualReport}
                questionDetail={questionDetail}
              />
            </IllustrationReportCard>
          </div>
        </div>
        <FloatingChat
          ref={chatRef}
          onSendMessage={handleSendMessage}
          disabled={isCommentDisabled}
        />
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-8">
        <p>質問の詳細を表示できません。</p>
      </div>
    </div>
  );
};

export default QuestionDetail;
