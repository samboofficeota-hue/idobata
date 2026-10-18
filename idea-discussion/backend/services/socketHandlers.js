import mongoose from "mongoose";
import ChatThread from "../models/ChatThread.js";
import { kaigiRoomChannel } from "./kaigi/wallEvents.js";
import { verifyUserToken } from "./userToken.js";

const isObjectIdString = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value);

export const registerSocketHandlers = (io) => {
  // 接続のときに利用者トークンを確かめる（なくても接続はできる。テーマと会議室の壁は公開の情報）
  io.use((socket, next) => {
    socket.data.userId = verifyUserToken(socket.handshake.auth?.userToken);
    next();
  });

  io.on("connection", (socket) => {
    socket.on("subscribe-theme", (themeId) => {
      if (isObjectIdString(themeId)) socket.join(`theme:${themeId}`);
    });

    // スレッドの更新（抽出された課題・解決策）は、そのスレッドの本人にだけ送る
    socket.on("subscribe-thread", async (threadId) => {
      if (!isObjectIdString(threadId) || !socket.data.userId) return;
      try {
        const thread = await ChatThread.findById(threadId)
          .select("userId")
          .lean();
        if (thread && thread.userId === socket.data.userId) {
          socket.join(`thread:${threadId}`);
        }
      } catch (error) {
        console.error("[Socket] subscribe-thread failed:", error.message);
      }
    });

    socket.on("unsubscribe-theme", (themeId) => {
      if (typeof themeId === "string") socket.leave(`theme:${themeId}`);
    });

    socket.on("unsubscribe-thread", (threadId) => {
      if (typeof threadId === "string") socket.leave(`thread:${threadId}`);
    });

    // いどばた会議室の壁（新しく貼られた提案を受け取る）
    socket.on("subscribe-kaigi-room", (roomId) => {
      if (isObjectIdString(roomId)) socket.join(kaigiRoomChannel(roomId));
    });

    socket.on("unsubscribe-kaigi-room", (roomId) => {
      if (typeof roomId === "string") socket.leave(kaigiRoomChannel(roomId));
    });
  });
};
