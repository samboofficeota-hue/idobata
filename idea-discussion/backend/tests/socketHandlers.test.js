import { createServer } from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ChatThread from "../models/ChatThread.js";
import { registerSocketHandlers } from "../services/socketHandlers.js";
import { signUserToken } from "../services/userToken.js";

const MONGO_URI =
  process.env.SOCKET_TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/idobata_socket_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

describe.skipIf(!mongoAvailable)("socket handlers", () => {
  let io;
  let http;
  let url;
  const clients = [];

  beforeAll(async () => {
    http = createServer();
    io = new Server(http);
    registerSocketHandlers(io);
    await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${http.address().port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    io?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  const open = (userToken) =>
    new Promise((resolve) => {
      const socket = connect(url, {
        auth: { userToken },
        transports: ["websocket"],
      });
      clients.push(socket);
      socket.on("connect", () => resolve(socket));
    });

  const roomMembers = async (room) =>
    (await io.in(room).fetchSockets()).map((s) => s.id);

  const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  it("lets only the thread owner subscribe to its updates", async () => {
    const thread = await ChatThread.create({
      themeId: new mongoose.Types.ObjectId(),
      userId: "socket-owner",
      sessionId: "s",
      messages: [],
    });
    const threadId = thread._id.toString();
    const owner = await open(signUserToken("socket-owner"));
    const other = await open(signUserToken("someone-else"));
    const anonymous = await open(undefined);
    const forged = await open("c29ja2V0LW93bmVy.forged");
    for (const s of [owner, other, anonymous, forged]) {
      s.emit("subscribe-thread", threadId);
    }
    await waitFor(200);
    expect(await roomMembers(`thread:${threadId}`)).toEqual([owner.id]);
  });

  it("ignores malformed room ids", async () => {
    const s = await open(undefined);
    s.emit("subscribe-theme", { $ne: null });
    s.emit("subscribe-theme", "not-an-id");
    const themeId = new mongoose.Types.ObjectId().toString();
    s.emit("subscribe-theme", themeId);
    await waitFor(100);
    expect(await roomMembers("theme:not-an-id")).toEqual([]);
    expect(await roomMembers(`theme:${themeId}`)).toEqual([s.id]);
  });
});
