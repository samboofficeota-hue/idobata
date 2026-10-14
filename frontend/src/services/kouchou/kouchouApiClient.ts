import type { KouchouReport, KouchouResult } from "./types";

// 広聴AIのAPI（FastAPI）は いどばたのbackendとは別サービスとして稼働する
const KOUCHOU_API_BASE_URL = (
  import.meta.env.VITE_KOUCHOU_API_BASE_URL ?? ""
).replace(/\/$/, "");
const KOUCHOU_PUBLIC_API_KEY =
  import.meta.env.VITE_KOUCHOU_PUBLIC_API_KEY ?? "";

export const isKouchouConfigured = KOUCHOU_API_BASE_URL !== "";

async function request<T>(path: string): Promise<T> {
  if (!isKouchouConfigured) {
    throw new Error(
      "広聴AIの接続先（VITE_KOUCHOU_API_BASE_URL）が設定されていません。"
    );
  }
  const response = await fetch(`${KOUCHOU_API_BASE_URL}${path}`, {
    headers: { "x-api-key": KOUCHOU_PUBLIC_API_KEY },
  });
  if (response.status === 404) {
    throw new Error("レポートが見つかりませんでした。");
  }
  if (!response.ok) {
    throw new Error(`広聴AIのデータ取得に失敗しました（${response.status}）`);
  }
  return (await response.json()) as T;
}

export const kouchouApiClient = {
  getReports: () => request<KouchouReport[]>("/reports"),
  getReport: (slug: string) =>
    request<KouchouResult>(`/reports/${encodeURIComponent(slug)}`),
};
