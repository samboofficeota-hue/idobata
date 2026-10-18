import { v4 as uuidv4 } from "uuid";

// 利用者（ログインなし）の ID と、サーバーが署名した利用者トークン
// トークンを x-user-token ヘッダーで送ると、サーバーはその ID の本人として扱う
// （以前は ID をそのまま送っていたため、他人の ID を知っていればなりすませた）

const ID_KEY = "idobataUserId";
const TOKEN_KEY = "idobataUserToken";
// 以前のチャット画面が使っていた ID。新しい ID がなければこちらを引き継ぐ
const LEGACY_ID_KEY = "userId";

export interface UserSession {
  userId: string;
  token: string;
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境では、開くたびに新しい ID になる
  }
};

let pending: Promise<UserSession> | null = null;

const requestSession = async (): Promise<UserSession> => {
  const storedId = read(ID_KEY) ?? read(LEGACY_ID_KEY);
  const storedToken = read(TOKEN_KEY);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/api/users/session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storedToken ? { "x-user-token": storedToken } : {}),
        },
        body: JSON.stringify(storedId ? { userId: storedId } : {}),
      }
    );
    if (!response.ok) throw new Error(`session ${response.status}`);
    const session = (await response.json()) as UserSession;
    write(ID_KEY, session.userId);
    write(TOKEN_KEY, session.token);
    return session;
  } catch (error) {
    console.error("Failed to get user session:", error);
    // 次の呼び出しでやり直す。それまでは手元の ID で表示だけはできるようにする
    pending = null;
    const userId = storedId ?? uuidv4();
    write(ID_KEY, userId);
    return { userId, token: storedToken ?? "" };
  }
};

// 最初の1回だけサーバーに問い合わせ、あとは同じ結果を返す
export const getUserSession = () => {
  if (!pending) pending = requestSession();
  return pending;
};

// すでに受け取っているトークン（Socket.IO の接続など、待てない場所で使う）
export const currentUserToken = () => read(TOKEN_KEY) ?? "";

export const userTokenHeader = async (): Promise<Record<string, string>> => {
  const { token } = await getUserSession();
  return token ? { "x-user-token": token } : {};
};
