import { userTokenHeader } from "../userSession";

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/hitori`;

const CODE_STORAGE_KEY = "hitoriAccessCode";

// 参加コード。一度通ったら、この端末では入れ直さなくてよいようにする
export const storedAccessCode = {
  get: () => {
    try {
      return localStorage.getItem(CODE_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (code: string) => {
    try {
      localStorage.setItem(CODE_STORAGE_KEY, code);
    } catch {
      // 保存できない環境では、開くたびに入力してもらう
    }
  },
  remove: () => {
    try {
      localStorage.removeItem(CODE_STORAGE_KEY);
    } catch {
      // 何もしない
    }
  },
};

const codeHeader = (): Record<string, string> => ({
  "x-hitori-code": storedAccessCode.get() ?? "",
});

export class HitoriApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

const post = async (path: string, init: RequestInit, fallback: string) => {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: "POST", ...init });
  } catch {
    throw new HitoriApiError("サーバーに接続できませんでした。", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HitoriApiError(data?.message ?? fallback, response.status);
  }
  return data;
};

export const hitoriApi = {
  verifyCode: async (code: string) => {
    await post(
      "/verify",
      { headers: { "x-hitori-code": code } },
      "参加コードを確かめられませんでした"
    );
  },
  // AIの役を1回呼ぶ。指示文はサーバーで作る
  ai: async (request: { kind: string; args: unknown[]; state: unknown }) => {
    const data = await post(
      "/ai",
      {
        headers: {
          "Content-Type": "application/json",
          ...codeHeader(),
          ...(await userTokenHeader()),
        },
        body: JSON.stringify(request),
      },
      "AIにつながりませんでした。"
    );
    return data?.result ?? null;
  },
  // 録音1回分を文字にする。JSON ではなくファイルで送る
  transcribe: async (audio: Blob): Promise<string> => {
    const form = new FormData();
    const ext = audio.type.includes("mp4") ? "mp4" : "webm";
    form.append("audio", audio, `speech.${ext}`);
    const data = await post(
      "/transcribe",
      {
        headers: { ...codeHeader(), ...(await userTokenHeader()) },
        body: form,
      },
      "音声を文字にできませんでした"
    );
    return typeof data?.text === "string" ? data.text : "";
  },
};
