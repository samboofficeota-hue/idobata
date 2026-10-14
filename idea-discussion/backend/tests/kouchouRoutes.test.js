import http from "node:http";
import express from "express";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// 管理画面ログインの代わりに、Authorizationヘッダーの有無だけを見る
vi.mock("../middleware/authMiddleware.js", () => ({
  protect: (req, res, next) =>
    req.headers.authorization
      ? next()
      : res.status(401).json({ message: "認証が必要です" }),
}));

process.env.KOUCHOU_CREATE_PASSWORD = "test-password";
const { default: kouchouRoutes } = await import("../routes/kouchouRoutes.js");

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

describe("kouchouRoutes", () => {
  let upstream;
  let app;
  let appBase;
  let received;

  beforeAll(async () => {
    // kouchou-ai のAPIの代わり
    upstream = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        received.push({
          method: req.method,
          url: req.url,
          apiKey: req.headers["x-api-key"],
          body: body ? JSON.parse(body) : undefined,
        });
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/admin/reports" && req.method === "GET") {
          res.end(
            JSON.stringify([
              { slug: "a", status: "ready" },
              { slug: "b", status: "deleted" },
            ])
          );
        } else if (req.url === "/admin/reports" && req.method === "POST") {
          if (!JSON.parse(body).question) {
            res.statusCode = 422;
            res.end(
              JSON.stringify({
                detail: [{ loc: ["body", "question"], msg: "Field required" }],
              })
            );
            return;
          }
          res.statusCode = 202;
          res.end("null");
        } else if (req.url === "/admin/reports/s1/status/step-json") {
          res.end(
            JSON.stringify({ current_step: "embedding", estimated_cost: 1.5 })
          );
        } else if (req.url === "/admin/reports/x%2Fy/config") {
          res.end(JSON.stringify({ success: true }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ detail: "Report not found" }));
        }
      });
    });
    const upstreamPort = await listen(upstream);
    process.env.KOUCHOU_API_URL = `http://127.0.0.1:${upstreamPort}/`;
    process.env.KOUCHOU_ADMIN_API_KEY = "secret-admin-key";

    const expressApp = express();
    expressApp.use("/api/kouchou", kouchouRoutes);
    app = http.createServer(expressApp);
    appBase = `http://127.0.0.1:${await listen(app)}/api/kouchou`;
  });

  afterAll(() => {
    upstream.close();
    app.close();
  });

  beforeEach(() => {
    received = [];
  });

  const auth = { Authorization: "Bearer token" };
  const withPassword = (password = "test-password") => ({
    "x-kouchou-password": password,
    "Content-Type": "application/json",
  });

  describe("管理画面", () => {
    it("ログインしていなければ広聴AIへ中継しない", async () => {
      const res = await fetch(`${appBase}/reports`);
      expect(res.status).toBe(401);
      expect(received).toHaveLength(0);
    });

    it("管理用APIキーを付けて中継し、削除済みの分析を除外する", async () => {
      const res = await fetch(`${appBase}/reports`, { headers: auth });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ slug: "a", status: "ready" }]);
      expect(received[0].apiKey).toBe("secret-admin-key");
    });

    it("管理画面からは分析を作成できない（作成は利用者向けサイトから）", async () => {
      const res = await fetch(`${appBase}/reports`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Q" }),
      });
      expect(res.status).toBe(404);
      expect(received).toHaveLength(0);
    });

    it("編集では許可した項目だけを送り、slugをエスケープする", async () => {
      const res = await fetch(`${appBase}/reports/x%2Fy/config`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Q", intro: "I", extra: "ignored" }),
      });
      expect(res.status).toBe(200);
      expect(received[0].body).toEqual({ question: "Q", intro: "I" });
    });
  });

  describe("利用者向けサイト（パスワード保護）", () => {
    it("パスワードが違えば401を返し、中継しない", async () => {
      const res = await fetch(`${appBase}/public/verify`, {
        method: "POST",
        headers: withPassword("wrong"),
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ message: "パスワードが違います" });
    });

    it("正しいパスワードなら確認が通る", async () => {
      const res = await fetch(`${appBase}/public/verify`, {
        method: "POST",
        headers: withPassword(),
      });
      expect(res.status).toBe(200);
    });

    it("許可した項目だけを送り、LLMの接続先は固定する（100kb超も受け付ける）", async () => {
      const comments = Array.from({ length: 3000 }, (_, i) => ({
        id: String(i),
        comment: "あ".repeat(50),
      }));
      const res = await fetch(`${appBase}/public/reports`, {
        method: "POST",
        headers: withPassword(),
        body: JSON.stringify({
          input: "s1",
          question: "Q",
          intro: "I",
          comments,
          provider: "local",
          local_llm_address: "169.254.169.254",
        }),
      });
      expect(res.status).toBe(202);
      const sent = received[0].body;
      expect(sent.comments).toHaveLength(3000);
      expect(sent.provider).toBe("openai");
      expect(sent.is_embedded_at_local).toBe(false);
      expect(sent).not.toHaveProperty("local_llm_address");
    });

    it("FastAPIのエラーをmessage形式で返す", async () => {
      const res = await fetch(`${appBase}/public/reports`, {
        method: "POST",
        headers: withPassword(),
        body: JSON.stringify({ input: "s1" }),
      });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        message: "body.question: Field required",
      });
    });

    it("進行状況は処理段階だけを返し、費用は返さない", async () => {
      const res = await fetch(`${appBase}/public/reports/s1/status`, {
        headers: withPassword(),
      });
      expect(await res.json()).toEqual({ current_step: "embedding" });
    });

    it("続けて失敗すると、正しいパスワードでもしばらく受け付けない", async () => {
      for (let i = 0; i < 10; i++) {
        await fetch(`${appBase}/public/verify`, {
          method: "POST",
          headers: withPassword("wrong"),
        });
      }
      const res = await fetch(`${appBase}/public/verify`, {
        method: "POST",
        headers: withPassword(),
      });
      expect(res.status).toBe(429);
    });
  });
});
