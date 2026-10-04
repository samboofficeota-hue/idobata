import express from "express";
import { protect } from "../middleware/authMiddleware.js";

// 広聴AI（kouchou-ai）の管理APIへの中継ルート
// 管理用APIキー（KOUCHOU_ADMIN_API_KEY）はブラウザに渡さず、このbackendだけが保持する。
// 分析の作成はLLMの費用が発生するため、すべてのルートで管理画面へのログインを必須にしている。

const router = express.Router();

// CSVのコメントをまとめて送るため、通常のJSON上限（100kb）より大きくする
router.use(express.json({ limit: "50mb" }));
router.use(protect);

const getConfig = () => ({
  baseUrl: (process.env.KOUCHOU_API_URL || "").replace(/\/$/, ""),
  apiKey: process.env.KOUCHOU_ADMIN_API_KEY || "",
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

// 過去の分析一覧（削除済みは除く）
router.get("/reports", (req, res) =>
  forward(res, "/admin/reports", {
    transform: (data) =>
      Array.isArray(data) ? data.filter((r) => r.status !== "deleted") : data,
  })
);

// 新規分析の開始
router.post("/reports", (req, res) =>
  forward(res, "/admin/reports", { method: "POST", body: req.body })
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
