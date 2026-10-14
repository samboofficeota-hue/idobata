import type {
  CreateKaigiRoomPayload,
  KaigiOutputs,
  KaigiRoom,
  KaigiSessionResponse,
  KaigiSlideContent,
  KaigiWallSlide,
} from "./types";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/kaigi`;
const PASSWORD_STORAGE_KEY = "kaigiHostPassword";

export class KaigiPasswordError extends Error {}

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
  init: RequestInit & { password?: string } = {}
): Promise<T> {
  const { password, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(password ? { "x-kaigi-password": password } : {}),
      },
    });
  } catch {
    throw new Error("サーバーに接続できませんでした。");
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401 && password !== undefined) {
    throw new KaigiPasswordError(data?.message ?? "パスワードが違います");
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
    request<{ id: string }>("/host/rooms", {
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
};
