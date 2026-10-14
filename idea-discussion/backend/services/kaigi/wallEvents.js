// 壁の更新を、壁を開いている画面へ送る（Socket.IO）
// server.js から io を受け取る。テストでは io を渡さないので、送信は何もしない

let ioRef = null;

export const setKaigiIo = (io) => {
  ioRef = io;
};

export const kaigiRoomChannel = (roomId) => `kaigi:${roomId}`;

export const emitSlidePosted = (roomId, slide) => {
  ioRef?.to(kaigiRoomChannel(roomId)).emit("kaigi-slide-posted", slide);
};
