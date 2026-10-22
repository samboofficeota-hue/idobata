import type {
  CreateKaigiRoomPayload,
  KaigiHostView,
  KaigiIntensity,
  KaigiMeetRecord,
  KaigiOutputs,
  KaigiRoom,
  KaigiSessionResponse,
  KaigiSlideContent,
  KaigiWallSlide,
} from "./types";

import { userTokenHeader } from "../userSession";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/kaigi`;
const PASSWORD_STORAGE_KEY = "kaigiHostPassword";

const HOST_KEYS_STORAGE_KEY = "kaigiHostKeys";

export class KaigiPasswordError extends Error {}
export class KaigiHostKeyError extends Error {}

// お題ごとのホスト用の鍵。作ったブラウザに残しておく（ほかの端末ではURLの # の後ろから受け取る）
const readHostKeys = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(HOST_KEYS_STORAGE_KEY) ?? "{}"
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const storedHostKeys = {
  get: (roomId: string): string | null => readHostKeys()[roomId] ?? null,
  set: (roomId: string, key: string) => {
    try {
      localStorage.setItem(
        HOST_KEYS_STORAGE_KEY,
        JSON.stringify({ ...readHostKeys(), [roomId]: key })
      );
    } catch {
      // 保存できない環境では、ホスト用のURLから開き直してもらう
    }
  },
  remove: (roomId: string) => {
    try {
      const { [roomId]: _removed, ...rest } = readHostKeys();
      localStorage.setItem(HOST_KEYS_STORAGE_KEY, JSON.stringify(rest));
    } catch {
      // 何もしない
    }
  },
};

// 同じタブの中では、一度通ったパスワードを再入力しなくてよいようにする
export const storedHostPassword = {
  get: () => {
    try {
      return sessionStorage.getItem(PASSWORD_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (password: string) => {
    try {
      sessionStorage.setItem(PASSWORD_STORAGE_KEY, password);
    } catch {
      // 保存できない環境では、作るたびに入力してもらう
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(PASSWORD_STORAGE_KEY);
    } catch {
      // 何もしない
    }
  },
};

async function request<T>(
  path: string,
  init: RequestInit & { password?: string; hostKey?: string } = {}
): Promise<T> {
  const { password, hostKey, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(await userTokenHeader()),
        ...(password ? { "x-kaigi-password": password } : {}),
        ...(hostKey ? { "x-kaigi-host-key": hostKey } : {}),
      },
    });
  } catch {
    throw new Error("サーバーに接続できませんでした。");
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401 && password !== undefined) {
    throw new KaigiPasswordError(data?.message ?? "パスワードが違います");
  }
  if (response.status === 403 && hostKey !== undefined) {
    throw new KaigiHostKeyError(
      data?.message ?? "ホスト用の鍵が正しくありません"
    );
  }
  if (!response.ok) {
    throw new Error(
      data?.message ?? `処理に失敗しました（${response.status}）`
    );
  }
  return data as T;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const kaigiApi = {
  verifyPassword: (password: string) =>
    request<{ ok: true }>("/host/verify", { method: "POST", password }),
  createRoom: (password: string, payload: CreateKaigiRoomPayload) =>
    request<{ id: string; hostKey: string }>("/host/rooms", {
      method: "POST",
      password,
      body: JSON.stringify(payload),
    }),

  getRoom: (roomId: string) =>
    request<{
      room: KaigiRoom;
      participantCount: number;
      submittedCount: number;
    }>(`/rooms/${encodeURIComponent(roomId)}`),
  getMySession: (roomId: string, userId: string) =>
    request<{
      session: KaigiSessionResponse["session"] | null;
      room: KaigiRoom;
    }>(
      `/rooms/${encodeURIComponent(roomId)}/my-session?userId=${encodeURIComponent(userId)}`
    ),
  join: (roomId: string, userId: string, nickname: string) =>
    post<KaigiSessionResponse>(
      `/rooms/${encodeURIComponent(roomId)}/sessions`,
      {
        userId,
        nickname,
      }
    ),
  getWall: (roomId: string) =>
    request<{ room: KaigiRoom; slides: KaigiWallSlide[] }>(
      `/rooms/${encodeURIComponent(roomId)}/wall`
    ),

  start: (sessionId: string, userId: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/start`, { userId }),
  sendMessage: (sessionId: string, userId: string, content: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/messages`, {
      userId,
      content,
    }),
  // 録音1回分を文字にする（発言としては保存しない）。JSON ではなくファイルで送る
  transcribe: async (sessionId: string, audio: Blob): Promise<string> => {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : "webm";
    form.append("audio", audio, `speech.${ext}`);
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/sessions/${sessionId}/transcribe`, {
        method: "POST",
        headers: await userTokenHeader(),
        body: form,
      });
    } catch {
      throw new Error("サーバーに接続できませんでした。");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message ?? `音声を文字にできませんでした（${response.status}）`
      );
    }
    return typeof data?.text === "string" ? data.text : "";
  },
  advance: (sessionId: string, userId: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/advance`, { userId }),
  prepareOverview: (sessionId: string, userId: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/overview`, { userId }),
  updateOutputs: (
    sessionId: string,
    userId: string,
    outputs: Partial<KaigiOutputs>
  ) =>
    request<KaigiSessionResponse>(`/sessions/${sessionId}/outputs`, {
      method: "PUT",
      body: JSON.stringify({ userId, ...outputs }),
    }),
  setIntensity: (
    sessionId: string,
    userId: string,
    intensity: KaigiIntensity
  ) =>
    request<KaigiSessionResponse>(`/sessions/${sessionId}/intensity`, {
      method: "PUT",
      body: JSON.stringify({ userId, intensity }),
    }),
  reviseStory: (sessionId: string, userId: string, comment: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/story/revise`, {
      userId,
      comment,
    }),
  confirmStory: (sessionId: string, userId: string, story: string) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/story/confirm`, {
      userId,
      story,
    }),
  submit: (
    sessionId: string,
    userId: string,
    slide: Partial<KaigiSlideContent>
  ) =>
    post<KaigiSessionResponse>(`/sessions/${sessionId}/submit`, {
      userId,
      slide,
    }),

  // ===== ホスト用の画面 =====
  getHost: (roomId: string, hostKey: string) =>
    request<KaigiHostView>(`/rooms/${encodeURIComponent(roomId)}/host`, {
      hostKey,
    }),
  connectGoogle: (roomId: string, hostKey: string) =>
    request<{ url: string }>(
      `/rooms/${encodeURIComponent(roomId)}/host/google/connect`,
      { method: "POST", hostKey }
    ),
  disconnectGoogle: (roomId: string, hostKey: string) =>
    request<KaigiHostView>(`/rooms/${encodeURIComponent(roomId)}/host/google`, {
      method: "DELETE",
      hostKey,
    }),
  scheduleMeeting: (
    roomId: string,
    hostKey: string,
    startAt: string,
    durationMinutes: number
  ) =>
    request<KaigiHostView>(
      `/rooms/${encodeURIComponent(roomId)}/host/meeting`,
      {
        method: "PUT",
        hostKey,
        body: JSON.stringify({ startAt, durationMinutes }),
      }
    ),
  cancelMeeting: (roomId: string, hostKey: string) =>
    request<KaigiHostView>(
      `/rooms/${encodeURIComponent(roomId)}/host/meeting`,
      { method: "DELETE", hostKey }
    ),
  removeTheme: (roomId: string, hostKey: string) =>
    request<KaigiHostView>(`/rooms/${encodeURIComponent(roomId)}/host/theme`, {
      method: "DELETE",
      hostKey,
    }),
  relinkTheme: (roomId: string, hostKey: string) =>
    request<KaigiHostView>(
      `/rooms/${encodeURIComponent(roomId)}/host/theme/relink`,
      { method: "POST", hostKey }
    ),
  getRecords: (roomId: string, hostKey: string) =>
    request<{ records: KaigiMeetRecord[] }>(
      `/rooms/${encodeURIComponent(roomId)}/host/records`,
      { hostKey }
    ),
  syncRecords: (roomId: string, hostKey: string) =>
    request<{ records: KaigiMeetRecord[] }>(
      `/rooms/${encodeURIComponent(roomId)}/host/records/sync`,
      { method: "POST", hostKey }
    ),
};
