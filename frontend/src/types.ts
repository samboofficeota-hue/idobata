import type { Dispatch, SetStateAction } from "react";

// React関連の型定義
export interface OutletContext {
  userId: string | null;
  setUserId: Dispatch<SetStateAction<string | null>>;
}

// メッセージ関連の型定義
export interface Message {
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  id?: string;
  /** AI応答待ちの「考え中」表示用。true のときローディング表示する */
  isThinking?: boolean;
}

export class UserMessage implements Message {
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  id?: string;
  isThinking?: boolean;
  constructor(
    content: string,
    createdAt: Date = new Date(),
    isStreaming = false,
    id?: string,
    isThinking = false
  ) {
    this.content = content;
    this.createdAt = createdAt;
    this.isStreaming = isStreaming;
    this.id = id;
    this.isThinking = isThinking;
  }
}

export class SystemMessage implements Message {
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  id?: string;
  isThinking?: boolean;
  constructor(
    content: string,
    createdAt: Date = new Date(),
    isStreaming = false,
    id?: string,
    isThinking = false
  ) {
    this.content = content;
    this.createdAt = createdAt;
    this.isStreaming = isStreaming;
    this.id = id;
    this.isThinking = isThinking;
  }
}

export class SystemNotification implements Message {
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
  id?: string;
  isThinking?: boolean;
  constructor(
    content: string,
    createdAt: Date = new Date(),
    isStreaming = false,
    id?: string,
    isThinking = false
  ) {
    this.content = content;
    this.createdAt = createdAt;
    this.isStreaming = isStreaming;
    this.id = id;
    this.isThinking = isThinking;
  }
}

/** 「考え中」メッセージの固定ID。応答到着時にこのIDのメッセージを置き換える */
export const THINKING_MESSAGE_ID = "thinking";

// 通知関連の型定義
export interface NotificationType {
  message: string;
  type: string;
  id: string;
}

export interface PreviousExtractions {
  problems: Problem[];
  solutions: Solution[];
}

// ドメインオブジェクトの型定義
export interface Problem {
  _id: string;
  statement: string;
  version?: number;
  sourceType?: string;
  createdAt?: string;
}

export interface Solution {
  _id: string;
  statement: string;
  version?: number;
  sourceType?: string;
  createdAt?: string;
}

export interface Question {
  _id: string;
  questionText: string;
  tagLine?: string;
  tags?: string[];
  createdAt?: string;
  issueCount?: number; // 追加: 関連する課題の数
  solutionCount?: number; // 追加: 関連する解決策の数
  likeCount?: number;
  themeId?: string;
  // 統一API用の集計データフィールド
  uniqueParticipantCount?: number; // 参加人数
}

export interface PolicyDraft {
  _id: string;
  title: string;
  content: string;
  version?: number;
  createdAt: string;
  /** 対象・目的・期待効果（問いの contextSets から） */
  representativeContextSet?: {
    target?: string;
    purpose?: string;
    expectedEffect?: string;
  } | null;
}

export interface DigestDraft {
  _id: string;
  title: string;
  content: string;
  version?: number;
  createdAt: string;
}

export interface RelatedProblem extends Problem {
  relevanceScore: number;
}

export interface RelatedSolution extends Solution {
  relevanceScore: number;
}

export interface QuestionDetails {
  question: Question;
  relatedProblems: RelatedProblem[];
  relatedSolutions: RelatedSolution[];
}

// UI関連の型定義
export type TabType = "questions" | "problems" | "solutions" | "policies";

export interface Theme {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  keyQuestionCount?: number;
  commentCount?: number;
  disableNewComment?: boolean;
}

export interface Opinion {
  id: string;
  type: "problem" | "solution";
  text: string;
  authorName: string;
  questionTagline: string;
  questionId: string;
  createdAt: string | Date;
  likeCount?: number;
  commentCount?: number;
}

export type MessageType = "user" | "system" | "system-message";

// WebSocketから送信されるデータの型を拡張
export interface ExtendedExtractionData {
  _id: string;
  statement: string;
  relevanceScore?: number;
}
