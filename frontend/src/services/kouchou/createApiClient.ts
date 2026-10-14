import type { CreateKouchouReportPayload } from "./types";

// 新規分析は いどばた backend を経由し、パスワードで保護している
// （広聴AIの管理用APIキーは backend だけが持つ）
const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/kouchou/public`;
const PASSWORD_STORAGE_KEY = "kouchouCreatePassword";

export class KouchouPasswordError extends Error {}

// 同じタブの中では、一度通ったパスワードを再入力しなくてよいようにする
export const storedPassword = {
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
      // 保存できない環境では、ページを開くたびに入力してもらう
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
  password: string,
  init: RequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-kouchou-password": password,
      },
    });
  } catch {
    throw new Error("サーバーに接続できませんでした。");
  }
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    throw new KouchouPasswordError(data?.message ?? "パスワードが違います");
  }
  if (!response.ok) {
    throw new Error(
      data?.message ?? `処理に失敗しました（${response.status}）`
    );
  }
  return data as T;
}

export const kouchouCreateApi = {
  verifyPassword: (password: string) =>
    request<{ ok: true }>("/verify", password, { method: "POST" }),
  createReport: (password: string, payload: CreateKouchouReportPayload) =>
    request<null>("/reports", password, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getProgress: (password: string, slug: string) =>
    request<{ current_step: string }>(
      `/reports/${encodeURIComponent(slug)}/status`,
      password
    ),
};
