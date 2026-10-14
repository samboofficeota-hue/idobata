// いどばた会議室 API の型（idea-discussion/backend/routes/kaigiRoutes.js と対応）

export type KaigiSpeaker =
  | "user"
  | "facilitator"
  | "member1"
  | "member2"
  | "member3"
  | "editor";

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
