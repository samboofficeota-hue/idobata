import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { apiClient } from "../../services/api/apiClient";
import { MessageType } from "../../types";
import type { AddMessageOptions } from "../chat/common/ChatProvider";
import { FloatingChat, type FloatingChatRef } from "../chat";
import BreadcrumbView from "../common/BreadcrumbView";
import KeyQuestionCard from "./KeyQuestionCard";
import ThemeCard from "./ThemeCard";

interface ThemeDetailTemplateProps {
  theme: {
    _id: string;
    title: string;
    description: string;
  };
  keyQuestions: {
    id: number | string;
    question: string;
    tagLine?: string;
    tags?: string[];
    voteCount: number;
    issueCount: number;
    solutionCount: number;
  }[];
  disabled?: boolean;
  onSendMessage?: (message: string) => void;
}

const ThemeDetailTemplate = forwardRef<
  FloatingChatRef,
  ThemeDetailTemplateProps
>(
  ({ theme, keyQuestions, disabled = false, onSendMessage }, ref) => {
    const chatRef = useRef<FloatingChatRef>(null);
    const [threadId, setThreadId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>(
      localStorage.getItem("userId") || crypto.randomUUID()
    );

    useImperativeHandle(ref, () => ({
      addMessage: (
        content: string,
        type: MessageType,
        options?: AddMessageOptions
      ) => {
        chatRef.current?.addMessage(content, type, options);
      },
      replaceMessage: (id: string, content: string) => {
        chatRef.current?.replaceMessage(id, content);
      },
      startStreamingMessage: (content: string, type: MessageType) => {
        return chatRef.current?.startStreamingMessage(content, type) || "";
      },
      updateStreamingMessage: (id: string, content: string) => {
        chatRef.current?.updateStreamingMessage(id, content);
      },
      endStreamingMessage: (id: string) => {
        chatRef.current?.endStreamingMessage(id);
      },
      clearMessages: () => {
        chatRef.current?.clearMessages();
      },
    }));

    const handleSendMessageInternal = async (message: string) => {
      console.log("Message sent:", message);

      if (onSendMessage) {
        onSendMessage(message);
        return;
      }

      chatRef.current?.addMessage(message, "user");

      const result = await apiClient.sendMessage(
        userId,
        message,
        theme._id,
        threadId || undefined
      );

      if (result.isErr()) {
        console.error("Failed to send message:", result.error);
        chatRef.current?.addMessage(
          `メッセージ送信エラー: ${result.error.message}`,
          "system"
        );
        return;
      }

      const responseData = result.value;

      chatRef.current?.addMessage(responseData.response, "system");

      if (responseData.threadId) {
        setThreadId(responseData.threadId);
      }

      if (responseData.userId && responseData.userId !== userId) {
        setUserId(responseData.userId);
        localStorage.setItem("userId", responseData.userId);
      }
    };

    const breadcrumbItems = [
      { label: "テーマ一覧", href: "/themes" },
      { label: theme.title, href: `/themes/${theme._id}` },
    ];

    useEffect(() => {
      if (!localStorage.getItem("userId")) {
        localStorage.setItem("userId", userId);
      }
    }, [userId]);

    return (
      <div className="container mx-auto px-6 py-8">
        <div>
          <BreadcrumbView items={breadcrumbItems} />
        </div>

        {/* 上部のテキストセクション */}
        <div className="mb-8 space-y-2">
          <h2 className="text-2xl-bold text-zinc-800">
            次のお題についてAIと対話しましょう
          </h2>
          <p className="text-md text-zinc-800">
            対話内容はAIによって自動要約されお題ごとのレポートにまとめられます。
          </p>
        </div>

        {/* お題カードセクション */}
        <div className="mb-8">
          <ThemeCard title={theme.title} description={theme.description} />
        </div>

        <div className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-wide mb-2">
              主な論点（{keyQuestions.length}件）
            </h2>
            <p className="text-gray-600">
              みんなの議論をまとめて論点を抽出しました
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {keyQuestions.map((question) => (
              <KeyQuestionCard
                key={question.id}
                question={question.question}
                tagLine={question.tagLine}
                tags={question.tags}
                voteCount={question.voteCount}
                issueCount={question.issueCount}
                solutionCount={question.solutionCount}
                themeId={theme._id}
                qid={question.id.toString()}
              />
            ))}
          </div>
        </div>

        <FloatingChat
          ref={chatRef}
          onSendMessage={handleSendMessageInternal}
          disabled={disabled}
          themeId={theme._id}
        />
      </div>
    );
  }
);

export default ThemeDetailTemplate;
