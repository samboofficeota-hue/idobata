import { Bot, Loader2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useDraggable } from "../../../hooks/useDraggable";
import { apiClient } from "../../../services/api/apiClient";
import { Button } from "../../ui/button";
import {
  ChatSheet as BaseChatSheet,
  ChatSheetContent,
} from "../../ui/chat/chat-sheet";
import { useChat } from "./ChatProvider";
import ExtendedChatHistory from "./ExtendedChatHistory";

interface ChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
  isDesktop?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
  themeId?: string | null;
  threadId?: string | null;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isDesktop = false,
  disabled = false,
  disabledMessage = "このテーマではコメントが無効化されています",
  themeId = null,
  threadId = null,
}) => {
  const { messages, addMessage, clearMessages } = useChat();
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { height } = useDraggable({
    minHeight: 400,
    maxHeight: window.innerHeight * 0.9,
    initialHeight: window.innerHeight * 0.75,
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isSending && isOpen && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [isSending, isOpen, disabled]);

  const handleSendMessage = async () => {
    if (inputValue.trim() && !isSending) {
      setIsSending(true);

      const message = inputValue;
      setInputValue("");

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "48px";
      }

      try {
        if (onSendMessage) {
          await onSendMessage(message);
        } else {
          addMessage(message, "user");
        }
      } catch (error) {
        console.error("Error sending message:", error);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const handleKeyDown = (
    e: React.KeyboardEvent & {
      isComposing?: boolean;
      nativeEvent: { isComposing?: boolean };
    }
  ) => {
    // Command+Enter (Mac) or Ctrl+Enter (Windows/Linux) for sending
    if (
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      !isSending &&
      !e.isComposing &&
      !e.nativeEvent.isComposing
    ) {
      e.preventDefault();
      handleSendMessage();
    }
    // Enter alone should just create a new line (default behavior)
  };

  const handleNewChat = async () => {
    // 新しいチャット: チャット履歴をクリアして新しい会話を開始
    // ユーザーの回答が少ない場合は抽出しない（2件未満の場合は抽出しない）
    // ここでは単にチャットをクリアするだけ
    clearMessages();

    // 初期メッセージを取得して追加
    if (themeId) {
      try {
        const result = await apiClient.getInitialChatMessage(themeId);
        if (result.isOk()) {
          addMessage(result.value.message, "system");
        }
      } catch (error) {
        console.error("Failed to get initial chat message:", error);
        // エラー時はデフォルトメッセージを追加
        addMessage(
          "こんにちは！このテーマについて、あなたの意見や考えを聞かせてください。",
          "system"
        );
      }
    } else {
      // themeIdがない場合はデフォルトメッセージを追加
      addMessage(
        "こんにちは！このテーマについて、あなたの意見や考えを聞かせてください。",
        "system"
      );
    }
  };

  const handleSubmitOpinion = async () => {
    // わたしの意見を送る: チャットスレッドの内容をProblem/Solutionに反映
    if (!threadId || !themeId) {
      console.error("Thread ID or Theme ID is missing");
      addMessage(
        "エラー: スレッド情報が見つかりません。",
        "system-message"
      );
      return;
    }

    setIsExtracting(true);
    try {
      const result = await apiClient.triggerExtractionForThread(
        threadId,
        themeId
      );

      if (result.isOk()) {
        addMessage(
          "あなたの意見を送信しました。ありがとうございます！",
          "system-message"
        );
        // 送信完了後に履歴をクリアしてから閉じる
        setTimeout(() => {
          clearMessages();
          onClose();
        }, 1500);
      } else {
        console.error("Error triggering extraction:", result.error);
        addMessage(
          result.error.message || "意見の送信に失敗しました。",
          "system-message"
        );
      }
    } catch (error) {
      console.error("Error submitting opinion:", error);
      addMessage("意見の送信中にエラーが発生しました。", "system-message");
    } finally {
      setIsExtracting(false);
    }
  };

  const renderDisabledState = () => (
    <div className="p-4 bg-gray-100 text-gray-500 text-center border-t">
      <p className="text-base">{disabledMessage}</p>
    </div>
  );

  // For desktop view, we don't use the sheet component
  if (isDesktop) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-[#E1EAFB] to-[#E5F5F7]">
        {/* AI Chat Header - Fixed at top */}
        <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-center">
            <Bot className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">
            AIチャット対話
          </h2>
        </div>

        {/* Chat Messages Area - Scrollable middle section */}
        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
          <ExtendedChatHistory messages={messages} />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0 bg-gradient-to-br from-[#E1EAFB] to-[#E5F5F7] border-t border-gray-200">
          {disabled ? (
            renderDisabledState()
          ) : (
            <div className="px-4 pb-4 pt-2 space-y-3">
              {/* チャット入力ボックス: 入力欄と送信ボタンのみ */}
              <div className="flex gap-2 items-end bg-white rounded-2xl border border-gray-400 p-2">
                <textarea
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="ここに入力（Enterで改行、⌘+Enterで送信）"
                  className="flex-1 px-3 py-2 bg-white border-0 rounded-xl focus:outline-none text-lg resize-none min-h-12 max-h-32 text-gray-700 placeholder-gray-400"
                  disabled={isSending}
                  rows={1}
                  style={{ height: "48px", overflow: "hidden" }}
                  ref={inputRef}
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg w-10 h-10 flex items-center justify-center text-xl font-bold shadow-sm flex-shrink-0"
                  disabled={!inputValue.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "↑"
                  )}
                </Button>
              </div>
              {/* 意見送付・新規チャットはボックスの下に独立表示 */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500 hover:border-cyan-600 rounded-full px-4 py-2 text-sm font-medium"
                  onClick={handleSubmitOpinion}
                  disabled={isExtracting || !threadId || !themeId}
                >
                  {isExtracting ? "送信中..." : "わたしの意見を送る"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-600 border-gray-300 hover:bg-gray-50 rounded-full px-4 py-2 text-sm font-medium"
                  onClick={handleNewChat}
                >
                  新しいチャット
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile view uses the sheet component
  return (
    <BaseChatSheet open={isOpen} onOpenChange={onClose}>
      <ChatSheetContent
        className="p-0 h-auto rounded-t-xl overflow-hidden bg-gradient-to-br from-[#E1EAFB] to-[#E5F5F7] flex flex-col"
        style={{ height: `${height}px` }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {/* AI Chat Header - Fixed at top */}
        <div className="flex items-center gap-2 p-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-center">
            <Bot className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">
            AIチャット対話
          </h2>
        </div>

        {/* Chat Messages Area - Scrollable middle section */}
        <div className="flex-1 overflow-auto px-3 py-2 space-y-2">
          <ExtendedChatHistory messages={messages} />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0 bg-gradient-to-br from-[#E1EAFB] to-[#E5F5F7] border-t border-gray-200">
          {disabled ? (
            renderDisabledState()
          ) : (
            <div className="px-4 pb-4 pt-2 space-y-3">
              {/* チャット入力ボックス: 入力欄と送信ボタンのみ */}
              <div className="flex gap-2 items-end bg-white rounded-2xl border border-gray-400 p-2">
                <textarea
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="ここに入力（Enterで改行、⌘+Enterで送信）"
                  className="flex-1 px-3 py-2 bg-white border-0 rounded-xl focus:outline-none text-lg resize-none min-h-12 max-h-32 text-gray-700 placeholder-gray-400"
                  disabled={isSending}
                  rows={1}
                  style={{ height: "48px", overflow: "hidden" }}
                  ref={inputRef}
                />
                <Button
                  onClick={handleSendMessage}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg w-10 h-10 flex items-center justify-center text-xl font-bold shadow-sm flex-shrink-0"
                  disabled={!inputValue.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "↑"
                  )}
                </Button>
              </div>
              {/* 意見送付・新規チャットはボックスの下に独立表示 */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500 hover:border-cyan-600 rounded-full px-4 py-2 text-sm font-medium"
                  onClick={handleSubmitOpinion}
                  disabled={isExtracting || !threadId || !themeId}
                >
                  {isExtracting ? "送信中..." : "わたしの意見を送る"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-600 border-gray-300 hover:bg-gray-50 rounded-full px-4 py-2 text-sm font-medium"
                  onClick={handleNewChat}
                >
                  新しいチャット
                </Button>
              </div>
            </div>
          )}
        </div>
      </ChatSheetContent>
    </BaseChatSheet>
  );
};
