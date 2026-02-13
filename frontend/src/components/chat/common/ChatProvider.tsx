import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";
import type { Message, MessageType } from "../../../types";
import { SystemMessage, SystemNotification, UserMessage } from "../../../types";

export interface AddMessageOptions {
  id?: string;
  isThinking?: boolean;
}

interface ChatContextType {
  messages: Message[];
  addMessage: (
    content: string,
    type: MessageType,
    options?: AddMessageOptions
  ) => void;
  replaceMessage: (id: string, content: string) => void;
  startStreamingMessage: (content: string, type: MessageType) => string;
  updateStreamingMessage: (id: string, content: string) => void;
  endStreamingMessage: (id: string) => void;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialSystemNotification = new SystemNotification(
    "チャットを開始しました",
    new Date(Date.now() - 1000 * 60 * 60) // 1時間前の日付で作成
  );

  const [messages, setMessages] = useState<Message[]>([
    initialSystemNotification,
  ]);

  const addMessage = useCallback(
    (
      content: string,
      type: MessageType,
      options?: AddMessageOptions
    ) => {
      const id = options?.id;
      const isThinking = options?.isThinking ?? false;
      let newMessage: Message;

      switch (type) {
        case "user":
          newMessage = new UserMessage(content, new Date(), false, id, isThinking);
          break;
        case "system":
          newMessage = new SystemMessage(
            content,
            new Date(),
            false,
            id,
            isThinking
          );
          break;
        case "system-message":
          newMessage = new SystemNotification(
            content,
            new Date(),
            false,
            id,
            isThinking
          );
          break;
        default:
          newMessage = new SystemMessage(
            content,
            new Date(),
            false,
            id,
            isThinking
          );
      }

      setMessages((prev) =>
        [...prev, newMessage].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )
      );
    },
    []
  );

  const replaceMessage = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== id) return msg;
        const updated = { ...msg, content, isThinking: false };
        if (msg instanceof SystemMessage) {
          return new SystemMessage(
            content,
            msg.createdAt,
            msg.isStreaming,
            msg.id,
            false
          );
        }
        if (msg instanceof UserMessage) {
          return new UserMessage(
            content,
            msg.createdAt,
            msg.isStreaming,
            msg.id,
            false
          );
        }
        if (msg instanceof SystemNotification) {
          return new SystemNotification(
            content,
            msg.createdAt,
            msg.isStreaming,
            msg.id,
            false
          );
        }
        return updated;
      })
    );
  }, []);

  const startStreamingMessage = useCallback(
    (content: string, type: MessageType) => {
      const id = Date.now().toString();
      let newMessage: Message;

      switch (type) {
        case "user":
          newMessage = new UserMessage(content, new Date(), true, id);
          break;
        case "system":
          newMessage = new SystemMessage(content, new Date(), true, id);
          break;
        case "system-message":
          newMessage = new SystemNotification(content, new Date(), true, id);
          break;
        default:
          newMessage = new SystemMessage(content, new Date(), true, id);
      }

      setMessages((prev) =>
        [...prev, newMessage].sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )
      );
      return id;
    },
    []
  );

  const updateStreamingMessage = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg))
    );
  }, []);

  const endStreamingMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isStreaming: false } : msg))
    );
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value = {
    messages,
    addMessage,
    replaceMessage,
    startStreamingMessage,
    updateStreamingMessage,
    endStreamingMessage,
    clearMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
