import express from "express";
import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// AIの代わり。指示文の種類で返す内容を変え、対話の返答は順番に積んだものを返す
const llm = vi.hoisted(() => ({
  turnReplies: [],
  calls: [],
  fail: false,
}));

vi.mock("../services/kaigi/llm.js", () => ({
  kaigiLLM: async (messages) => {
    const system = messages[0].content;
    llm.calls.push(system);
    if (llm.fail) throw new Error("upstream down");
    if (system.includes("論点を整理する補助役")) {
      return {
        issueCandidates: ["放置自転車が通路をふさぐ", "高齢者の移動手段"],
        ideaCandidates: ["登録制にする"],
        conflicts: ["廃止か存続か"],
        agreements: [],
      };
    }
    if (system.includes("1つのストーリーの文章にまとめる")) {
      const last = messages[messages.length - 1].content;
      return {
        story: last.includes("コメント")
          ? "書き直したストーリー"
          : "最初のストーリー",
      };
    }
    if (system.includes("壁に貼る1枚のスライド")) {
      return {
        title: "登録制で共用自転車を残す",
        domain: "共用自転車",
        issue: "放置自転車",
        solution: "登録制",
        summary: "要点",
        tags: ["安全", "費用"],
      };
    }
    return (
      llm.turnReplies.shift() ?? {
        speaker: "member1",
        content: "それで誰が助かりますか？",
        capture: {},
        advance: false,
      }
    );
  },
}));

process.env.KAIGI_HOST_PASSWORD = "test-password";
const { default: kaigiRoutes } = await import("../routes/kaigiRoutes.js");

// ローカルや CI に MongoDB がなければ、このテストは飛ばす
const MONGO_URI =
  process.env.KAIGI_TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/kaigi_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

describe.skipIf(!mongoAvailable)("kaigiRoutes", () => {
  let server;
  let base;

  const call = async (method, path, body, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const host = { "x-kaigi-password": "test-password" };

  const createRoom = async (overrides = {}) => {
    const res = await call(
      "POST",
      "/host/rooms",
      {
        title: "共用自転車をどうするか",
        background: "利用が減っている",
        capacity: 5,
        ...overrides,
      },
      host
    );
    expect(res.status).toBe(201);
    return res.body.id;
  };

  const join = (roomId, userId, nickname = userId) =>
    call("POST", `/rooms/${roomId}/sessions`, { userId, nickname });

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.model("KaigiSession").syncIndexes();
    const app = express();
    app.use(express.json());
    app.use("/api/kaigi", kaigiRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api/kaigi`;
  });

  afterAll(async () => {
    server?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    llm.turnReplies = [];
    llm.calls = [];
    llm.fail = false;
  });

  it("protects room creation with the host password", async () => {
    expect((await call("POST", "/host/verify", {}, {})).status).toBe(401);
    expect(
      (
        await call(
          "POST",
          "/host/rooms",
          { title: "x", capacity: 5 },
          { "x-kaigi-password": "nope" }
        )
      ).status
    ).toBe(401);
    expect(
      (await call("POST", "/host/rooms", { title: "x", capacity: 7 }, host))
        .status
    ).toBe(400);
    expect(
      (await call("POST", "/host/rooms", { capacity: 5 }, host)).status
    ).toBe(400);
    expect((await call("POST", "/host/verify", {}, host)).body).toEqual({
      ok: true,
    });
  });

  it("caps participants at the room capacity and resumes a returning user", async () => {
    const roomId = await createRoom();
    expect((await join(roomId, "u0", "")).status).toBe(400);

    const first = await join(roomId, "u1", "いち");
    expect(first.status).toBe(201);
    const again = await join(roomId, "u1", "別の名前");
    expect(again.status).toBe(200);
    expect(again.body.session.id).toBe(first.body.session.id);
    expect(again.body.session.nickname).toBe("いち");

    for (const u of ["u2", "u3", "u4", "u5"]) {
      expect((await join(roomId, u)).status).toBe(201);
    }
    const full = await join(roomId, "u6");
    expect(full.status).toBe(409);

    const info = await call("GET", `/rooms/${roomId}`);
    expect(info.body.participantCount).toBe(5);
    expect(info.body.room.capacity).toBe(5);
  });

  it("only lets the owner read or act on a session", async () => {
    const roomId = await createRoom();
    const { body } = await join(roomId, "owner");
    const id = body.session.id;
    expect((await call("GET", `/sessions/${id}?userId=someone`)).status).toBe(
      403
    );
    expect(
      (await call("POST", `/sessions/${id}/start`, { userId: "someone" }))
        .status
    ).toBe(403);
    expect((await call("GET", `/sessions/${id}?userId=owner`)).status).toBe(
      200
    );
    expect(JSON.stringify(body)).not.toContain('"userId"');
  });

  it("runs the ten steps and posts the slide on the wall", async () => {
    const roomId = await createRoom();
    const { body: joined } = await join(roomId, "flow", "はなこ");
    const id = joined.session.id;
    const u = { userId: "flow" };
    const say = (content) =>
      call("POST", `/sessions/${id}/messages`, { ...u, content });

    // 1 → 2：定型の最初の一言（AIは呼ばない）
    let res = await call("POST", `/sessions/${id}/start`, u);
    expect(res.body.session.step).toBe(2);
    expect(res.body.session.messages).toHaveLength(1);
    expect(res.body.session.outputs.domain).toBe("共用自転車をどうするか");
    expect(res.body.session.timing.totalRemainingSec).toBeGreaterThan(19 * 60);

    // 工程2では、AIがメンバーを名乗ってもファシリテーターとして扱う
    llm.turnReplies.push({
      speaker: "member3",
      content: "具体的には？",
      advance: false,
    });
    res = await say("放置自転車が多くて困っています");
    expect(res.body.session.messages.at(-1).speaker).toBe("facilitator");

    // AIの判断で工程3へ。みんなの声の整理が付いてくる
    llm.turnReplies.push({
      speaker: "facilitator",
      content: "ほかの声を見てみましょう",
      advance: true,
    });
    res = await say("高齢の親は自転車がないと困るとも聞きます");
    expect(res.body.session.step).toBe(3);
    expect(res.body.session.overview.issueCandidates).toContain(
      "放置自転車が通路をふさぐ"
    );

    // 工程3で発言はできない
    expect((await say("まだ話したい")).status).toBe(409);

    // 3 → 4：ボタンで進み、ファシリテーターの最初の一言が来る
    llm.turnReplies.push({
      speaker: "facilitator",
      content: "メンバーを紹介します。何を課題にしますか？",
    });
    res = await call("POST", `/sessions/${id}/advance`, u);
    expect(res.body.session.step).toBe(4);
    expect(llm.calls.at(-1)).toContain("ミナミ");

    llm.turnReplies.push({
      speaker: "member2",
      content: "どれが一番ですか？",
      advance: true,
    });
    res = await say("通路の安全が一番気になります");
    expect(res.body.session.step).toBe(5);

    // 5：課題が書き留められるまで、ボタンでも進めない
    expect((await call("POST", `/sessions/${id}/advance`, u)).status).toBe(400);
    llm.turnReplies.push({
      speaker: "facilitator",
      content: "では、アイディアを出しましょう",
      capture: { issue: "放置自転車で通路がふさがる", solution: "まだ早い" },
      advance: true,
    });
    res = await say("放置自転車で通路がふさがることが課題です");
    expect(res.body.session.step).toBe(6);
    expect(res.body.session.outputs).toMatchObject({
      issue: "放置自転車で通路がふさがる",
      solution: "",
    });

    // 6 → 7 → 8：ボタンで進む
    res = await call("POST", `/sessions/${id}/advance`, u);
    expect(res.body.session.step).toBe(7);
    res = await call("POST", `/sessions/${id}/advance`, u);
    expect(res.body.session.step).toBe(8);

    // 8：3点がそろうまで次へ進めない。参加者が自分で書き直せる
    res = await call("PUT", `/sessions/${id}/outputs`, { ...u, solution: "" });
    expect((await call("POST", `/sessions/${id}/advance`, u)).status).toBe(400);
    res = await call("PUT", `/sessions/${id}/outputs`, {
      ...u,
      solution: "登録制にして残す",
    });
    expect(res.body.session.missingToLeave).toEqual([]);

    // 8 → 9：編集者がストーリーにする
    res = await call("POST", `/sessions/${id}/advance`, u);
    expect(res.body.session.step).toBe(9);
    expect(res.body.session.story.draft).toBe("最初のストーリー");

    res = await call("POST", `/sessions/${id}/story/revise`, {
      ...u,
      comment: "もっと短く",
    });
    expect(res.body.session.story.draft).toBe("書き直したストーリー");

    // 9 → 10：確定するとスライドになる
    res = await call("POST", `/sessions/${id}/story/confirm`, {
      ...u,
      story: "自分で直したストーリー",
    });
    expect(res.body.session.step).toBe(10);
    expect(res.body.session.story.final).toBe("自分で直したストーリー");
    expect(res.body.session.slide.tags).toEqual(["安全", "費用"]);

    // 提出すると壁に貼られる。2回目は受け付けない
    res = await call("POST", `/sessions/${id}/submit`, {
      ...u,
      slide: { title: "自分の見出し" },
    });
    expect(res.body.session.status).toBe("submitted");
    expect((await call("POST", `/sessions/${id}/submit`, u)).status).toBe(409);

    const wall = await call("GET", `/rooms/${roomId}/wall`);
    expect(wall.body.slides).toHaveLength(1);
    expect(wall.body.slides[0]).toMatchObject({
      nickname: "はなこ",
      title: "自分の見出し",
      solution: "登録制",
    });
    expect(JSON.stringify(wall.body)).not.toContain("flow");
  });

  it("does not save the participant's message when the AI fails", async () => {
    const roomId = await createRoom();
    const { body } = await join(roomId, "fail");
    const id = body.session.id;
    await call("POST", `/sessions/${id}/start`, { userId: "fail" });

    llm.fail = true;
    const res = await call("POST", `/sessions/${id}/messages`, {
      userId: "fail",
      content: "こんにちは",
    });
    expect(res.status).toBe(502);

    const after = await call("GET", `/sessions/${id}?userId=fail`);
    expect(after.body.session.messages).toHaveLength(1);
    expect(after.body.session.step).toBe(2);
  });

  it("sets every document to expire with the room", async () => {
    const roomId = await createRoom();
    const indexes = await mongoose.connection
      .collection("kaigisessions")
      .indexes();
    expect(
      indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)
    ).toBe(true);
    const { body } = await join(roomId, "ttl");
    const room = await mongoose.model("KaigiRoom").findById(roomId).lean();
    const session = await mongoose
      .model("KaigiSession")
      .findById(body.session.id)
      .lean();
    expect(session.expiresAt.getTime()).toBe(room.expiresAt.getTime());
    const days = (room.expiresAt - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });
});
