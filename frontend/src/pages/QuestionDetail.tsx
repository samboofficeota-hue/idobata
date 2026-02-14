import {
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FloatingChat, type FloatingChatRef } from "../components/chat";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import CitizenOpinionContent from "../components/question/CitizenOpinionContent";
import DebatePointsContent from "../components/question/DebatePointsContent";
import IllustrationSummaryContent from "../components/question/IllustrationSummaryContent";
import OtherOpinionCard from "../components/question/OtherOpinionCard";
import SolutionIdeasContent from "../components/question/SolutionIdeasContent";
import ThemePromptSection from "../components/question/ThemePromptSection";
import {
  DownloadButton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useQuestionDetail } from "../hooks/useQuestionDetail";
import { useThemeDetail } from "../hooks/useThemeDetail";
import { QuestionChatManager } from "../services/chatManagers/QuestionChatManager";
import { socketClient } from "../services/socket/socketClient";
import type { NewExtractionEvent } from "../services/socket/socketClient";
import { apiClient } from "../services/api/apiClient";
import { ExtendedExtractionData, MessageType } from "../types";
import type { PolicyDraft } from "../types";

const QuestionDetail = () => {
  const { themeId, qId } = useParams<{ themeId: string; qId: string }>();
  const { user } = useAuth();
  const chatRef = useRef<FloatingChatRef>(null);
  const [isOpinionsExpanded, setIsOpinionsExpanded] = useState(false);
  const [isIllustrationOpen, setIsIllustrationOpen] = useState(false);
  const [chatManager, setChatManager] = useState<QuestionChatManager | null>(
    null
  );
  const [threadId, setThreadId] = useState<string | null>(null);

  const { questionDetail, isLoading, error } = useQuestionDetail(
    themeId || "",
    qId || ""
  );
  const [opinions, setOpinions] = useState<{
    issues: Array<{ id: string; text: string; relevance: number }>;
    solutions: Array<{ id: string; text: string; relevance: number }>;
  }>({ issues: [], solutions: [] });
  const [policyDrafts, setPolicyDrafts] = useState<PolicyDraft[]>([]);
  const { themeDetail: themeInfo } = useThemeDetail(themeId || "");

  // PolicyDraft 一覧取得（解決アイディアカード用）
  useEffect(() => {
    if (!themeId || !qId) return;
    const fetchPolicyDrafts = async () => {
      const result = await apiClient.getPolicyDraftsByQuestion(themeId, qId);
      if (result.isOk()) setPolicyDrafts(result.value);
      else setPolicyDrafts([]);
    };
    fetchPolicyDrafts();
  }, [themeId, qId]);

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

      // Update threadId when manager loads chat history
      const updateThreadId = () => {
        const currentThreadId = manager.getThreadId();
        if (currentThreadId) {
          setThreadId(currentThreadId);
        }
      };

      // Initial check after a short delay to allow chat history to load
      setTimeout(updateThreadId, 1000);

      return () => {
        console.log("Cleaning up ChatManager");
        manager.cleanup();
      };
    }
  }, [themeId, qId, questionDetail, user?.id]);

  // Update threadId when chatManager sends a message (which sets threadId)
  useEffect(() => {
    if (chatManager) {
      const currentThreadId = chatManager.getThreadId();
      if (currentThreadId && currentThreadId !== threadId) {
        setThreadId(currentThreadId);
      }
    }
  }, [chatManager, threadId]);

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
      <div className="xl:mr-[480px]">
        <div className="w-full max-w-5xl pl-4 pr-4 md:pl-8 md:pr-8">
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="py-8 space-y-8">
            <div className="h-8 w-3/4 max-w-xl bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
            <div className="bg-gray-100 rounded-xl p-6 md:p-8 space-y-4">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-20 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-20 w-4/5 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-6 mt-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-6 md:p-8">
                <div className="h-7 w-40 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
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
        {/* 右側480pxはAIチャット用。コンテンツは左寄せ・読みやすい幅に */}
        <div className="xl:mr-[480px]">
          <div className="w-full max-w-5xl pl-4 pr-4 md:pl-8 md:pr-8">
            <div>
              <BreadcrumbView items={breadcrumbItems} />
            </div>
            <div className="py-8">
              <ThemePromptSection
                  themeTitle={themeData.title}
                themeDescription={themeInfo?.theme?.description || ""}
                participantCount={questionDetail?.participantCount || 0}
                dialogueCount={questionDetail?.dialogueCount || 0}
                questionTitle={questionData.tagLine || questionData.question}
                questionDescription={questionData.question}
                questionTags={questionData.tags}
                visualReport={questionDetail?.visualReport ?? null}
                onOpenIllustration={() => setIsIllustrationOpen(true)}
              />
            </div>

            {/* みんなの論点 */}
            <section className="mb-16">
              <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <SectionHeading title="みんなの論点" className="mb-0 py-0" />
                </div>
                {questionDetail?.visualReport &&
                  typeof questionDetail.visualReport === "string" &&
                  !questionDetail.visualReport.includes("<!DOCTYPE html>") &&
                  !questionDetail.visualReport.includes("<html") && (
                    <DownloadButton
                      downloadType="image"
                      data={{ imageUrl: questionDetail.visualReport }}
                    >
                      イラスト要約をダウンロード
                    </DownloadButton>
                  )}
              </div>
              <div className="rounded-xl border border-border bg-card p-6 md:p-8">
                <DebatePointsContent debateData={questionDetail?.debateData} />
              </div>
            </section>

            {/* みんなのアイディア */}
            <section className="mb-16">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <SectionHeading title="みんなのアイディア" className="mb-0 py-0" />
              </div>
              <div className="rounded-xl border border-border bg-card p-6 md:p-8">
                <CitizenOpinionContent digestDraft={questionDetail?.digestDraft} />
              </div>
            </section>

            {/* みんなの解決デザイン */}
            <section className="mb-16">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <SectionHeading title="みんなの解決デザイン" className="mb-0 py-0" />
              </div>
              <div className="rounded-xl border border-border bg-card p-6 md:p-8">
                <SolutionIdeasContent
                  policyDrafts={policyDrafts}
                  questionHmw={questionData.tagLine || questionData.question}
                />
              </div>
            </section>

            {/* みんなの意見（対話参加人数・対話数は上部の問いカードに表示） */}
            <section className="mb-16">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  <Lightbulb className="h-5 w-5 text-muted-foreground" />
                </div>
                <SectionHeading title="みんなの意見" className="mb-0 py-0" />
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
            </section>
          </div>
        </div>

        {/* イラストまとめモーダル */}
        <Sheet open={isIllustrationOpen} onOpenChange={setIsIllustrationOpen}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-2xl overflow-y-auto"
          >
            <SheetHeader>
              <SheetTitle>イラストまとめ</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <IllustrationSummaryContent
                visualReport={questionDetail?.visualReport ?? null}
                questionDetail={questionDetail}
              />
            </div>
          </SheetContent>
        </Sheet>

        <FloatingChat
          ref={chatRef}
          onSendMessage={handleSendMessage}
          disabled={isCommentDisabled}
          themeId={themeId || null}
          threadId={threadId}
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
