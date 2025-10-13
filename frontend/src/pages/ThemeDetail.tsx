import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { type FloatingChatRef } from "../components/chat";
import ThemeDetailTemplate from "../components/theme/ThemeDetailTemplate";
import { useAuth } from "../contexts/AuthContext";
import { useMock } from "../contexts/MockContext";
import { useThemeDetail } from "../hooks/useThemeDetail";
import { ThemeDetailChatManager } from "../services/chatManagers/ThemeDetailChatManager";
import type { NewExtractionEvent } from "../services/socket/socketClient";
import type { Message } from "../types";
import { SystemMessage, SystemNotification } from "../types";

const ThemeDetail = () => {
  const { themeId } = useParams<{ themeId: string }>();
  const { isMockMode } = useMock();
  const { user } = useAuth();
  const floatingChatRef = useRef<FloatingChatRef>(null);
  const [chatManager, setChatManager] = useState<ThemeDetailChatManager | null>(
    null
  );

  const {
    themeDetail: apiThemeDetail,
    isLoading: apiIsLoading,
    error: apiError,
  } = useThemeDetail(themeId || "");

  const themeDetail = isMockMode ? null : apiThemeDetail;
  const isLoading = isMockMode ? false : apiIsLoading;
  const error = isMockMode ? null : apiError;

  const isCommentDisabled = isMockMode
    ? false
    : themeDetail?.theme?.disableNewComment === true;

  useEffect(() => {
    if (!themeId) return;

    const themeName = themeDetail?.theme?.title ?? "";

    if (themeName && user.id) {
      const manager = new ThemeDetailChatManager({
        themeId,
        themeName,
        userId: user.id,
        onNewMessage: handleNewMessage,
        onNewExtraction: handleNewExtraction,
      });

      setChatManager(manager);

      return () => {
        manager.cleanup();
      };
    }
  }, [themeId, isMockMode, themeDetail?.theme?.title, user?.id]);

  const handleNewMessage = (message: Message) => {
    if (floatingChatRef.current) {
      const messageType =
        message instanceof SystemNotification
          ? "system-message"
          : message instanceof SystemMessage
            ? "system"
            : "user";

      floatingChatRef.current.addMessage(message.content, messageType);
    }
  };

  const handleNewExtraction = (extraction: NewExtractionEvent) => {
    console.log("New extraction received:", extraction);
  };

  const handleSendMessage = async (message: string) => {
    if (chatManager) {
      await chatManager.addMessage(message, "user");
    }
  };

  if (!isMockMode && isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 xl:max-w-none">
        <div className="text-center py-8">
          <p>テーマの詳細を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isMockMode && error) {
    return (
      <div className="container mx-auto px-4 py-8 xl:max-w-none">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (themeDetail) {
    const templateProps = {
      theme: {
        _id: themeDetail.theme?._id ?? "",
        title: themeDetail.theme?.title ?? "",
        description: themeDetail.theme?.description ?? "",
      },
      keyQuestions:
        themeDetail.keyQuestions?.map((q) => ({
          id: q._id ?? "",
          question: q.questionText ?? "",
          tagLine: q.tagLine ?? "",
          tags: q.tags ?? [],
          voteCount: q.voteCount ?? 0,
          issueCount: q.issueCount ?? 0, // issueCountを使用
          solutionCount: q.solutionCount ?? 0,
        })) ?? [],
      issues:
        themeDetail.issues?.map((issue) => ({
          id: issue._id ?? "",
          text: issue.statement ?? "",
        })) ?? [],
      solutions:
        themeDetail.solutions?.map((solution) => ({
          id: solution._id ?? "",
          text: solution.statement ?? "",
        })) ?? [],
    };

    return (
      <>
        <div className="md:mr-[50%]">
          <ThemeDetailTemplate
            {...templateProps}
            onSendMessage={handleSendMessage}
            disabled={isCommentDisabled}
            ref={floatingChatRef}
          />
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 xl:max-w-none">
      <div className="text-center py-8">
        <p>テーマの詳細を表示できません。</p>
      </div>
    </div>
  );
};

export default ThemeDetail;
