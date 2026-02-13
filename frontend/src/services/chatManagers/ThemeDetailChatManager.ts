import { apiClient } from "../../services/api/apiClient";
import { socketClient } from "../../services/socket/socketClient";
import type { NewExtractionEvent } from "../../services/socket/socketClient";
import {
  Message,
  MessageType,
  SystemMessage,
  SystemNotification,
  THINKING_MESSAGE_ID,
  UserMessage,
} from "../../types";

export interface ThemeDetailChatManagerOptions {
  themeId: string;
  themeName: string;
  userId: string;
  onNewMessage?: (message: Message) => void;
  /** 「考え中」メッセージを実際の応答で置き換えるときに呼ぶ */
  onReplaceMessage?: (messageId: string, content: string) => void;
  onNewExtraction?: (extraction: NewExtractionEvent) => void;
}

export class ThemeDetailChatManager {
  private themeId: string;
  private themeName: string;
  private messages: Message[] = [];
  private onNewMessage?: (message: Message) => void;
  private onReplaceMessage?: (messageId: string, content: string) => void;
  private onNewExtraction?: (extraction: NewExtractionEvent) => void;
  private threadId?: string;
  private unsubscribeNewExtraction?: () => void;
  private unsubscribeExtractionUpdate?: () => void;
  private userId: string;

  constructor(options: ThemeDetailChatManagerOptions) {
    this.themeId = options.themeId;
    this.themeName = options.themeName;
    this.onNewMessage = options.onNewMessage;
    this.onReplaceMessage = options.onReplaceMessage;
    this.onNewExtraction = options.onNewExtraction;
    this.userId = options.userId;

    this.loadChatHistory().then(() => {
      if (this.threadId) {
        this.subscribeToExtraction();
      }
    });

    this.showThemeNotification();
  }

  private showThemeNotification(): void {
    const notification = new SystemNotification(
      `「${this.themeName}」がチャット対象になりました。`
    );
    this.messages.push(notification);
    this.onNewMessage?.(notification);
  }

  async addMessage(content: string, type: MessageType): Promise<void> {
    switch (type) {
      case "user": {
        this.subscribeToExtraction();
        const userMessage = new UserMessage(content);

        this.messages.push(userMessage);
        this.onNewMessage?.(userMessage);

        await this.sendMessageToBackend(content);
        return;
      }
      case "system": {
        const systemMessage = new SystemMessage(content);
        this.messages.push(systemMessage);
        this.onNewMessage?.(systemMessage);
        break;
      }
      case "system-message": {
        const systemNotification = new SystemNotification(content);
        this.messages.push(systemNotification);
        this.onNewMessage?.(systemNotification);
        break;
      }
      default: {
        const defaultMessage = new SystemMessage(content);
        this.messages.push(defaultMessage);
        this.onNewMessage?.(defaultMessage);
      }
    }
  }

  private async sendMessageToBackend(userMessage: string): Promise<void> {
    if (this.onReplaceMessage) {
      const thinkingMessage = new SystemMessage(
        "考え中…",
        new Date(),
        false,
        THINKING_MESSAGE_ID,
        true
      );
      this.messages.push(thinkingMessage);
      this.onNewMessage?.(thinkingMessage);
    }

    try {
      const result = await apiClient.sendMessage(
        this.userId,
        userMessage,
        this.themeId,
        this.threadId
      );

      if (result.isOk()) {
        const { response, threadId } = result.value;

        if (threadId && !this.threadId) {
          this.setThreadId(threadId);
        }

        if (response && this.onReplaceMessage) {
          this.onReplaceMessage(THINKING_MESSAGE_ID, response);
          const lastMsg = this.messages[this.messages.length - 1];
          if (lastMsg?.id === THINKING_MESSAGE_ID) {
            lastMsg.content = response;
            lastMsg.isThinking = false;
          }
        } else if (response) {
          const systemResponse = new SystemMessage(response);
          this.messages.push(systemResponse);
          this.onNewMessage?.(systemResponse);
        }
      } else {
        if (this.onReplaceMessage) {
          this.onReplaceMessage(
            THINKING_MESSAGE_ID,
            "メッセージの送信中にエラーが発生しました。"
          );
          const lastMsg = this.messages[this.messages.length - 1];
          if (lastMsg?.id === THINKING_MESSAGE_ID) {
            lastMsg.content = "メッセージの送信中にエラーが発生しました。";
            lastMsg.isThinking = false;
          }
        } else {
          const errorMessage = new SystemMessage(
            "メッセージの送信中にエラーが発生しました。"
          );
          this.messages.push(errorMessage);
          this.onNewMessage?.(errorMessage);
        }
        console.error("Error sending message:", result.error);
      }
    } catch (error) {
      console.error("Error in sendMessageToBackend:", error);
      if (this.onReplaceMessage) {
        this.onReplaceMessage(
          THINKING_MESSAGE_ID,
          "メッセージの送信中にエラーが発生しました。"
        );
        const lastMsg = this.messages[this.messages.length - 1];
        if (lastMsg?.id === THINKING_MESSAGE_ID) {
          lastMsg.content = "メッセージの送信中にエラーが発生しました。";
          lastMsg.isThinking = false;
        }
      } else {
        const errorMessage = new SystemMessage(
          "メッセージの送信中にエラーが発生しました。"
        );
        this.messages.push(errorMessage);
        this.onNewMessage?.(errorMessage);
      }
    }
  }

  private subscribeToExtraction(): void {
    console.log(
      `[ThemeDetailChatManager] Subscribing to theme: ${this.themeId}`
    );
    socketClient.subscribeToTheme(this.themeId);
    if (this.threadId) {
      console.log(
        `[ThemeDetailChatManager] Subscribing to thread: ${this.threadId}`
      );
      socketClient.subscribeToThread(this.threadId);
    }

    if (this.unsubscribeNewExtraction) {
      console.log(
        "[ThemeDetailChatManager] Unsubscribing from previous new-extraction"
      );
      this.unsubscribeNewExtraction();
    }
    if (this.unsubscribeExtractionUpdate) {
      console.log(
        "[ThemeDetailChatManager] Unsubscribing from previous extraction-update"
      );
      this.unsubscribeExtractionUpdate();
    }

    console.log("[ThemeDetailChatManager] Registering new-extraction handler");
    this.unsubscribeNewExtraction = socketClient.onNewExtraction(
      this.handleNewExtraction.bind(this)
    );
    console.log(
      "[ThemeDetailChatManager] Registering extraction-update handler"
    );
    this.unsubscribeExtractionUpdate = socketClient.onExtractionUpdate(
      this.handleExtractionUpdate.bind(this)
    );
  }

  private handleNewExtraction(event: NewExtractionEvent): void {
    console.log(
      "[ThemeDetailChatManager] handleNewExtraction called with event:",
      event
    );
    const { type, data } = event;
    const notificationContent =
      type === "problem"
        ? `「${data.statement}」という課題が登録されました。`
        : `「${data.statement}」という解決策が登録されました。`;

    console.log(
      `[ThemeDetailChatManager] Creating notification: ${notificationContent}`
    );
    const notification = new SystemNotification(notificationContent);
    this.messages.push(notification);

    console.log("[ThemeDetailChatManager] Calling onNewMessage callback");
    this.onNewMessage?.(notification);

    console.log("[ThemeDetailChatManager] Calling onNewExtraction callback");
    this.onNewExtraction?.(event);
  }

  private handleExtractionUpdate(event: NewExtractionEvent): void {
    this.onNewExtraction?.(event);
  }

  setThreadId(threadId: string): void {
    this.threadId = threadId;
    socketClient.subscribeToThread(threadId);
  }

  cleanup(): void {
    if (this.unsubscribeNewExtraction) {
      this.unsubscribeNewExtraction();
    }
    if (this.unsubscribeExtractionUpdate) {
      this.unsubscribeExtractionUpdate();
    }

    socketClient.unsubscribeFromTheme(this.themeId);
    if (this.threadId) {
      socketClient.unsubscribeFromThread(this.threadId);
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  private saveThreadIdToStorage(): void {
    if (this.threadId) {
      localStorage.setItem(`chat_thread_${this.themeId}`, this.threadId);
    }
  }

  async loadChatHistory(): Promise<void> {
    if (!this.userId) {
      console.log("No user ID available, cannot load chat history");
      return;
    }

    const result = await apiClient.getThreadByUserAndTheme(
      this.userId,
      this.themeId
    );

    if (!result.isOk()) {
      console.error("Error loading chat history:", result.error);
      return;
    }

    const { threadId, messages } = result.value;

    this.threadId = threadId;
    this.saveThreadIdToStorage();

    if (!messages || messages.length === 0) {
      console.log("No chat history found");
      return;
    }

    this.clearMessages();

    this.showThemeNotification();

    for (const msg of messages as Array<{ role: string; content: string }>) {
      const { role, content } = msg;

      if (role === "user") {
        const userMessage = new UserMessage(content);
        this.messages.push(userMessage);
        this.onNewMessage?.(userMessage);
      } else if (role === "assistant") {
        const systemMessage = new SystemMessage(content);
        this.messages.push(systemMessage);
        this.onNewMessage?.(systemMessage);
      }
    }

    console.log(`Loaded ${messages.length} messages from chat history`);
  }
}
