import express from "express";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// socketService は server.js を読み込む（サーバーが起動してしまう）ので差し替える
vi.mock("../services/socketService.js", () => ({
  emitNewExtraction: () => {},
  emitExtractionUpdate: () => {},
}));

// セキュリティ対策の通しのテスト（利用者トークン・本人確認・アップロード・
// MongoDB の演算子・管理者の初期化・回数制限）。MongoDB がなければ飛ばす

process.env.PASSWORD_PEPPER = "test-pepper";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.ADMIN_BOOTSTRAP_TOKEN = "bootstrap-secret";

const { attachUser } = await import("../middleware/userTokenMiddleware.js");
const { rejectMongoOperators } = await import(
  "../middleware/rejectMongoOperators.js"
);
const { rateLimit } = await import("express-rate-limit");
const { signUserToken, verifyUserToken } = await import(
  "../services/userToken.js"
);
const { detectImageExtension } = await import(
  "../middleware/uploadMiddleware.js"
);
const { default: userRoutes } = await import("../routes/userRoutes.js");
const { default: likeRoutes } = await import("../routes/likeRoutes.js");
const { default: questionRoutes } = await import("../routes/questionRoutes.js");
const { default: themeChatRoutes } = await import(
  "../routes/themeChatRoutes.js"
);
const { default: authRoutes } = await import("../routes/authRoutes.js");
const { default: ChatThread } = await import("../models/ChatThread.js");
const { default: AdminUser } = await import("../models/AdminUser.js");
const { default: authService } = await import(
  "../services/auth/authService.js"
);

const MONGO_URI =
  process.env.SECURITY_TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/idobata_security_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

describe("user tokens", () => {
  it("round-trips and rejects tampering", () => {
    const token = signUserToken("user-abc");
    expect(verifyUserToken(token)).toBe("user-abc");
    const [id, mac] = token.split(".");
    expect(verifyUserToken(`${id}.${mac.slice(0, -1)}A`)).toBeNull();
    const otherId = Buffer.from("user-xyz").toString("base64url");
    expect(verifyUserToken(`${otherId}.${mac}`)).toBeNull();
    expect(verifyUserToken(undefined)).toBeNull();
    expect(verifyUserToken("a.b.c")).toBeNull();
  });

  it("detects images by content, not by name", () => {
    expect(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      ".jpg"
    );
    expect(
      detectImageExtension(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe(".png");
    expect(detectImageExtension(Buffer.from("GIF89a.."))).toBe(".gif");
    expect(detectImageExtension(Buffer.from("<html><script>"))).toBeNull();
  });
});

describe.skipIf(!mongoAvailable)("protected routes", () => {
  let server;
  let base;
  const themeId = new mongoose.Types.ObjectId().toString();

  const call = async (method, path, { body, token, headers = {} } = {}) => {
    const isForm = body instanceof FormData;
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...(token ? { "x-user-token": token } : {}),
        ...headers,
      },
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    for (const name of ["UserTokenClaim", "Like", "AdminUser"]) {
      await mongoose.model(name).syncIndexes();
    }
    const app = express();
    app.use(express.json());
    app.use(rejectMongoOperators);
    app.use(attachUser);
    app.use("/api/users", userRoutes);
    app.use("/api/likes", likeRoutes);
    app.use("/api/questions", questionRoutes);
    app.use("/api/themes/:themeId/chat", themeChatRoutes);
    app.use("/api/auth", authRoutes);
    // 回数制限の動きを見るための小さな上限
    app.get(
      "/limited",
      rateLimit({ windowMs: 60000, limit: 2, message: { message: "slow" } }),
      (req, res) => res.json({ ok: true })
    );
    app.use((err, req, res, next) => {
      if (err?.name === "MulterError" || err?.status === 400) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: "error" });
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    server?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("issues a token once per existing userId, then hands out new ids", async () => {
    const first = await call("POST", "/api/users/session", {
      body: { userId: "legacy-device-id" },
    });
    expect(first.body.userId).toBe("legacy-device-id");
    expect(verifyUserToken(first.body.token)).toBe("legacy-device-id");

    // 同じ userId をあとから名乗っても、そのトークンはもらえない
    const thief = await call("POST", "/api/users/session", {
      body: { userId: "legacy-device-id" },
    });
    expect(thief.status).toBe(201);
    expect(thief.body.userId).not.toBe("legacy-device-id");

    // トークンを持っていれば、同じ userId のまま
    const again = await call("POST", "/api/users/session", {
      token: first.body.token,
    });
    expect(again.body.userId).toBe("legacy-device-id");
  });

  it("lets only the owner change a profile", async () => {
    const mine = signUserToken("profile-owner");
    expect(
      (
        await call("PUT", "/api/users/profile-owner", {
          body: { displayName: "x" },
        })
      ).status
    ).toBe(401);
    expect(
      (
        await call("PUT", "/api/users/profile-owner", {
          body: { displayName: "x" },
          token: signUserToken("someone-else"),
        })
      ).status
    ).toBe(403);
    expect(
      (
        await call("PUT", "/api/users/profile-owner", {
          body: { displayName: "はなこ" },
          token: mine,
        })
      ).status
    ).toBe(200);
  });

  it("rejects an upload whose content is not an image", async () => {
    const token = signUserToken("uploader");
    const html = new FormData();
    html.append(
      "profileImage",
      new Blob(["<script>alert(1)</script>"], { type: "image/png" }),
      "evil.html"
    );
    const bad = await call("POST", "/api/users/uploader/profile-image", {
      body: html,
      token,
    });
    expect(bad.status).toBe(400);

    const png = new FormData();
    png.append(
      "profileImage",
      new Blob(
        [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])],
        { type: "image/png" }
      ),
      "photo.html"
    );
    const good = await call("POST", "/api/users/uploader/profile-image", {
      body: png,
      token,
    });
    expect(good.status).toBe(200);
    // 拡張子は元の名前（.html）ではなく中身から決まる
    expect(good.body.profileImageUrl).toMatch(/\.png$/);
    const user = await mongoose.model("User").findOne({ userId: "uploader" });
    await import("node:fs/promises").then((fs) =>
      fs.unlink(user.profileImagePath)
    );
  });

  it("keeps chat threads private to their owner", async () => {
    const thread = await ChatThread.create({
      themeId,
      userId: "thread-owner",
      sessionId: "s1",
      messages: [{ role: "user", content: "ひみつ" }],
    });
    const path = `/api/themes/${themeId}/chat/threads/${thread._id}/messages`;
    expect((await call("GET", path)).status).toBe(401);
    expect(
      (await call("GET", path, { token: signUserToken("intruder") })).status
    ).toBe(403);
    const own = await call("GET", path, {
      token: signUserToken("thread-owner"),
    });
    expect(own.status).toBe(200);
    expect(own.body.messages[0].content).toBe("ひみつ");
    expect(own.body.userId).toBeUndefined();

    // 他人の userId でスレッドを探すこともできない
    const lookup = await call(
      "GET",
      `/api/themes/${themeId}/chat/thread?userId=thread-owner`,
      { token: signUserToken("intruder") }
    );
    expect(lookup.status).toBe(403);

    // 他人のスレッドに書き込めない（AIを呼ぶ前に断る）
    const post = await call("POST", `/api/themes/${themeId}/chat/messages`, {
      body: { message: "のっとり", threadId: thread._id.toString() },
      token: signUserToken("intruder"),
    });
    expect(post.status).toBe(403);
  });

  it("rejects MongoDB operators in requests", async () => {
    const targetId = new mongoose.Types.ObjectId().toString();
    const res = await call("POST", `/api/likes/question/${targetId}`, {
      body: { userId: { $ne: null } },
      token: signUserToken("liker"),
    });
    expect(res.status).toBe(400);
    const login = await call("POST", "/api/auth/login", {
      body: { email: { $gt: "" }, password: "x" },
    });
    expect(login.status).toBe(400);
  });

  it("counts likes per user, and only removes your own", async () => {
    const q = new mongoose.Types.ObjectId().toString();
    const a = signUserToken("liker-a");
    const b = signUserToken("liker-b");
    expect((await call("POST", `/api/questions/${q}/like`)).status).toBe(401);
    await call("POST", `/api/questions/${q}/like`, { token: a });
    const twice = await call("POST", `/api/questions/${q}/like`, { token: a });
    expect(twice.body.count).toBe(1);
    expect(
      (await call("DELETE", `/api/questions/${q}/like`, { token: b })).status
    ).toBe(404);
    const removed = await call("DELETE", `/api/questions/${q}/like`, {
      token: a,
    });
    expect(removed.body.count).toBe(0);
  });

  it("needs the bootstrap token to create the first admin, and keeps the last admin", async () => {
    const body = { name: "管理者", email: "admin@example.com", password: "pw-123456" };
    expect((await call("POST", "/api/auth/initialize", { body })).status).toBe(
      403
    );
    expect(
      (
        await call("POST", "/api/auth/initialize", {
          body,
          headers: { "x-admin-bootstrap-token": "wrong" },
        })
      ).status
    ).toBe(403);
    expect(
      (
        await call("POST", "/api/auth/initialize", {
          body,
          headers: { "x-admin-bootstrap-token": "bootstrap-secret" },
        })
      ).status
    ).toBe(201);

    const admin = await AdminUser.findOne({ email: "admin@example.com" });
    const jwt = authService.generateToken(admin);
    const auth = { Authorization: `Bearer ${jwt}` };
    expect(
      (await call("DELETE", "/api/auth/admin-users/all", { headers: auth }))
        .status
    ).toBe(404);
    expect(
      (
        await call("DELETE", "/api/auth/admin-users", {
          body: { email: "admin@example.com" },
          headers: auth,
        })
      ).status
    ).toBe(409);
  });

  it("limits repeated requests", async () => {
    expect((await call("GET", "/limited")).status).toBe(200);
    expect((await call("GET", "/limited")).status).toBe(200);
    const third = await call("GET", "/limited");
    expect(third.status).toBe(429);
    expect(third.body.message).toBe("slow");
  });
});
