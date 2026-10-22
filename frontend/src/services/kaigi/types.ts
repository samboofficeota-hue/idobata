// いどばた会議室 API の型（idea-discussion/backend/routes/kaigiRoutes.js と対応）

export type KaigiSpeaker =
  | "user"
  | "facilitator"
  | "member1"
  | "member2"
  | "member3"
  | "editor";

// AIメンバーの問い詰める強さ（参加者が選ぶ）
export type KaigiIntensity = "gentle" | "normal" | "strict";

export type KaigiMemberKey = "member1" | "member2" | "member3";
// お題に合わせたAIメンバーの名前と立場
export type KaigiMembers = Record<
  KaigiMemberKey,
  { name: string; role: string }
>;

export type KaigiOutputKey = "domain" | "issue" | "solution";
export type KaigiOutputs = Record<KaigiOutputKey, string>;

export interface KaigiRoom {
  id: string;
  title: string;
  background: string;
  hostName: string;
  capacity: number;
  sessionMinutes: number;
  expiresAt: string;
  members: KaigiMembers;
  // ホストが Google カレンダーに登録した会議（なければ null）
  meeting: KaigiMeeting | null;
}

export interface KaigiMeeting {
  meetUrl: string;
  startAt: string | null;
  endAt: string | null;
}

export interface KaigiMessage {
  speaker: KaigiSpeaker;
  content: string;
  step: number;
  createdAt: string;
}

export interface KaigiOverview {
  issueCandidates: string[];
  ideaCandidates: string[];
  conflicts: string[];
  agreements: string[];
  voiceCount: number;
  updatedAt: string;
}

export interface KaigiSlideContent {
  title: string;
  domain: string;
  issue: string;
  solution: string;
  summary: string;
  tags: string[];
}

export interface KaigiSession {
  id: string;
  roomId: string;
  nickname: string;
  step: number;
  stepLabel: string;
  status: "active" | "submitted";
  intensity: KaigiIntensity;
  messages: KaigiMessage[];
  outputs: KaigiOutputs;
  missingToLeave: KaigiOutputKey[];
  story: { draft: string; final: string };
  slide: KaigiSlideContent;
  overview: KaigiOverview | null;
  timing: {
    serverNow: string;
    startedAt: string | null;
    deadlineAt: string | null;
    totalRemainingSec: number;
    stepRemainingSec: number | null;
    overtime: boolean;
  };
}

export interface KaigiSessionResponse {
  session: KaigiSession;
  room: KaigiRoom;
}

export interface KaigiWallSlide extends KaigiSlideContent {
  id: string;
  nickname: string;
  createdAt: string;
}

export interface CreateKaigiRoomPayload {
  title: string;
  background: string;
  hostName: string;
  capacity: number;
}

// ===== ホスト用の画面（routes/kaigiHostRoutes.js と対応） =====

export interface KaigiHostMeeting extends KaigiMeeting {
  meetingCode: string;
  calendarHtmlLink: string;
  recordsSyncedAt: string | null;
}

export interface KaigiHostGoogle {
  // サーバーに Google 連携の設定があるか
  available: boolean;
  connected: boolean;
  email?: string;
  canCreateMeeting?: boolean;
  canReadRecords?: boolean;
}

// お題に紐づいた、いどばたのテーマと、そこから作ったお題の軸カード（AIメンバー3体が立つ論点）
export interface KaigiHostAxis {
  proposition: string;
  agreement: string[];
  affirmative: string;
  negative: string;
  undecidedReason: string;
}

export interface KaigiHostTheme {
  // 紐づいたテーマの名前（紐づいていなければ空）
  themeTitle: string;
  removedByHost: boolean;
  checkedAt: string | null;
  axes: KaigiHostAxis[];
}

export interface KaigiHostView {
  room: Pick<KaigiRoom, "id" | "title" | "hostName" | "capacity" | "expiresAt">;
  google: KaigiHostGoogle;
  meeting: KaigiHostMeeting | null;
  theme: KaigiHostTheme;
}

export interface KaigiTranscriptEntry {
  speaker: string;
  text: string;
  startTime: string | null;
}

export interface KaigiMeetRecord {
  id: string;
  startTime: string | null;
  endTime: string | null;
  transcripts: {
    state: string;
    docsUrl: string;
    entries: KaigiTranscriptEntry[];
  }[];
  recordings: { state: string; url: string }[];
}
