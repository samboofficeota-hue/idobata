import crypto from "node:crypto";
import express from "express";
import { protect } from "../middleware/authMiddleware.js";

// 広聴AI（kouchou-ai）の管理APIへの中継ルート
// 管理用APIキー（KOUCHOU_ADMIN_API_KEY）はブラウザに渡さず、このbackendだけが保持する。
//  - /public/* : 利用者向けサイトの「新規分析」。パスワード（KOUCHOU_CREATE_PASSWORD）で保護
//  - それ以外  : 管理画面の分析管理。管理画面へのログイン（protect）が必須

const router = express.Router();

// CSVのコメントをまとめて送るため、通常のJSON上限（100kb）より大きくする
router.use(express.json({ limit: "50mb" }));

// 暫定パスワード。本番では環境変数 KOUCHOU_CREATE_PASSWORD で必ず変更すること
const DEFAULT_CREATE_PASSWORD = "dd";
if (!process.env.KOUCHOU_CREATE_PASSWORD) {
  console.warn(
    "[kouchouRoutes] KOUCHOU_CREATE_PASSWORD が未設定のため、広聴AIの新規分析に暫定パスワードを使っています"
  );
}

const getConfig = () => ({
  baseUrl: (process.env.KOUCHOU_API_URL || "").replace(/\/$/, ""),
  apiKey: process.env.KOUCHOU_ADMIN_API_KEY || "",
  createPassword:
    process.env.KOUCHOU_CREATE_PASSWORD || DEFAULT_CREATE_PASSWORD,
});

// kouchou-ai(FastAPI)のエラー形式 { detail } を、いどばたの形式 { message } に揃える
const toMessage = (data, status) => {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).join(".")}: ${d.msg}`)
      .join(" / ");
  }
  return `広聴AIのAPIでエラーが発生しました（${status}）`;
};

const forward = async (
  res,
  path,
  { method = "GET", body, transform = (data) => data } = {}
) => {
  const { baseUrl, apiKey } = getConfig();
  if (!baseUrl || !apiKey) {
    return res.status(503).json({
      message:
        "広聴AIの接続設定（KOUCHOU_API_URL / KOUCHOU_ADMIN_API_KEY）がされていません",
    });
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ message: toMessage(data, response.status) });
    }
    return res.status(response.status).json(transform(data));
  } catch (error) {
    console.error(`[kouchouRoutes] ${method} ${path} failed:`, error);
    return res
      .status(502)
      .json({ message: "広聴AIのAPIに接続できませんでした" });
  }
};

const slugPath = (req) => encodeURIComponent(req.params.slug);

// ===== 利用者向けサイト（パスワード保護） =====

// パスワードの総当たりを防ぐため、IPごとに失敗回数を数える
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map();

const isLockedOut = (ip) => {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
};

const recordFailure = (ip) => {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) {
    failures.set(ip, { count: 1, since: Date.now() });
  } else {
    entry.count += 1;
  }
};

const passwordMatches = (input) => {
  const expected = Buffer.from(getConfig().createPassword);
  const actual = Buffer.from(typeof input === "string" ? input : "");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
};

const requireCreatePassword = (req, res, next) => {
  const ip = req.ip;
  if (isLockedOut(ip)) {
    return res.status(429).json({
      message:
        "パスワードの入力に続けて失敗したため、しばらく時間をおいてから試してください",
    });
  }
  if (!passwordMatches(req.get("x-kouchou-password"))) {
    recordFailure(ip);
    return res.status(401).json({ message: "パスワードが違います" });
  }
  failures.delete(ip);
  next();
};

const publicRouter = express.Router();
publicRouter.use(requireCreatePassword);

// パスワードの確認だけを行う（新規分析ページを開く前のモーダル用）
publicRouter.post("/verify", (req, res) => res.json({ ok: true }));

// 新規分析の開始
// 利用者向けサイトから送れる項目だけを取り出し、LLMの接続先などは固定する
publicRouter.post("/reports", (req, res) => {
  const b = req.body ?? {};
  return forward(res, "/admin/reports", {
    method: "POST",
    body: {
      input: b.input,
      question: b.question,
      intro: b.intro,
      cluster: b.cluster,
      model: b.model,
      workers: b.workers,
      prompt: b.prompt,
      comments: b.comments,
      is_pubcom: Boolean(b.is_pubcom),
      inputType: "file",
      provider: "openai",
      is_embedded_at_local: false,
    },
  });
});

// 開始した分析の進行状況
publicRouter.get("/reports/:slug/status", (req, res) =>
  forward(res, `/admin/reports/${slugPath(req)}/status/step-json`, {
    // 費用などの内部情報は返さない
    transform: (data) => ({ current_step: data?.current_step }),
  })
);

router.use("/public", publicRouter);

// ===== 管理画面（ログイン必須） =====

router.use(protect);

// 過去の分析一覧（削除済みは除く）
router.get("/reports", (req, res) =>
  forward(res, "/admin/reports", {
    transform: (data) =>
      Array.isArray(data) ? data.filter((r) => r.status !== "deleted") : data,
  })
);

// 分析の進行状況
router.get("/reports/:slug/status", (req, res) =>
  forward(res, `/admin/reports/${slugPath(req)}/status/step-json`)
);

// タイトル・調査概要の更新
router.patch("/reports/:slug/config", (req, res) =>
  forward(res, `/admin/reports/${slugPath(req)}/config`, {
    method: "PATCH",
    body: { question: req.body?.question, intro: req.body?.intro },
  })
);

// 公開設定の更新
router.patch("/reports/:slug/visibility", (req, res) =>
  forward(res, `/admin/reports/${slugPath(req)}/visibility`, {
    method: "PATCH",
    body: { visibility: req.body?.visibility },
  })
);

// 分析の削除（広聴AI側では削除済みステータスになる）
router.delete("/reports/:slug", (req, res) =>
  forward(res, `/admin/reports/${slugPath(req)}`, { method: "DELETE" })
);

export default router;
