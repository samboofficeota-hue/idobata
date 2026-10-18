import crypto from "node:crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import KaigiGoogleAccount from "../../models/KaigiGoogleAccount.js";
import KaigiMeetRecord from "../../models/KaigiMeetRecord.js";
import KaigiOAuthState from "../../models/KaigiOAuthState.js";
import KaigiRoom from "../../models/KaigiRoom.js";
import {
  decryptToken,
  encryptToken,
  tokenKeyConfigured,
} from "./googleCrypto.js";

// いどばた会議室の Google 連携
//  - ホストが自分の Google アカウントをお題ごとに連携する（OAuth 2.0 の認可コード + PKCE）
//  - ① Google カレンダーに Meet 付きの予定を作る（Calendar API）
//  - ② その Meet の文字起こしと録画の場所を取り込む（Meet REST API v2）
// アクセストークンはブラウザに渡さない。リフレッシュトークンは暗号化して保存する

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly";
export const GOOGLE_SCOPES = ["openid", "email", CALENDAR_SCOPE, MEET_SCOPE];

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const MEET_API = "https://meet.googleapis.com/v2";
const STATE_TTL_MS = 10 * 60 * 1000;
// 取り込みすぎを防ぐ上限（会議の回数・1回の文字起こしの発言数）
const MAX_RECORDS = 20;
const MAX_ENTRIES = 5000;
const MEETING_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

// 画面にそのまま出せる文言と、返す HTTP ステータスを持つエラー
export class KaigiGoogleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const config = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.KAIGI_GOOGLE_REDIRECT_URI,
});

export const googleConfigured = () => {
  const { clientId, clientSecret, redirectUri } = config();
  return (
    Boolean(clientId && clientSecret && redirectUri) && tokenKeyConfigured()
  );
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const newClient = () => new OAuth2Client(config());

// ===== 連携（OAuth） =====

export const startAuth = async (roomId) => {
  const client = newClient();
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();
  const state = crypto.randomBytes(32).toString("base64url");
  await KaigiOAuthState.create({
    stateHash: sha256(state),
    roomId,
    codeVerifier,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  // お題ごとにリフレッシュトークンを受け取るため、毎回同意画面を出す
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });
};

// state を1回だけ使う。正しくなければ null
const consumeState = async (state) => {
  if (typeof state !== "string" || !state) return null;
  const entry = await KaigiOAuthState.findOneAndDelete({
    stateHash: sha256(state),
  });
  return entry && entry.expiresAt >= new Date() ? entry : null;
};

// 同意画面で「キャンセル」されたとき。戻す先のお題を返す（state が正しくなければ null）
export const cancelAuth = async (state) => {
  const entry = await consumeState(state);
  return entry ? entry.roomId.toString() : null;
};

// Google から戻ってきたとき。失敗したときも、戻す先のお題が分かれば error.roomId に入れる
export const finishAuth = async ({ code, state }) => {
  const entry = await consumeState(state);
  if (!entry) {
    throw new KaigiGoogleError(
      400,
      "連携の有効期限が切れました。もう一度やり直してください"
    );
  }
  const roomId = entry.roomId.toString();
  try {
    if (typeof code !== "string" || !code) {
      throw new KaigiGoogleError(400, "連携の情報が足りません");
    }
    await saveAccount(entry, code);
  } catch (error) {
    error.roomId = roomId;
    throw error;
  }
  return { roomId };
};

const saveAccount = async (entry, code) => {
  const room = await KaigiRoom.findById(entry.roomId);
  if (!room) throw new KaigiGoogleError(404, "お題が見つかりません");

  const client = newClient();
  const { tokens } = await client.getToken({
    code,
    codeVerifier: entry.codeVerifier,
  });
  if (!tokens.refresh_token || !tokens.id_token) {
    throw new KaigiGoogleError(
      502,
      "Google から必要な情報が返りませんでした。もう一度やり直してください"
    );
  }
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config().clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new KaigiGoogleError(502, "Google アカウントを確認できませんでした");
  }

  // 別の Google アカウントに替えるときは、前のアカウントの許可を取り消す
  const previous = await KaigiGoogleAccount.findOne({ roomId: room._id });
  if (previous && previous.googleSub !== payload.sub) {
    await revokeIfUnused(previous);
  }

  await KaigiGoogleAccount.findOneAndUpdate(
    { roomId: room._id },
    {
      roomId: room._id,
      googleSub: payload.sub,
      email: payload.email ?? "",
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      expiresAt: room.expiresAt,
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

// Google の取り消しは、そのアカウントがこのアプリに出した許可をまとめて無効にする。
// 同じアカウントで連携している別のお題があれば、取り消さずに記録だけ消す
const revokeIfUnused = async (account) => {
  const others = await KaigiGoogleAccount.countDocuments({
    googleSub: account.googleSub,
    _id: { $ne: account._id },
  });
  if (others > 0) return;
  try {
    await newClient().revokeToken(decryptToken(account.refreshTokenEnc));
  } catch (error) {
    console.warn(
      `[kaigi/google] revoke failed room=${account.roomId}:`,
      error.message
    );
  }
};

export const disconnect = async (roomId) => {
  const account = await KaigiGoogleAccount.findOne({ roomId });
  if (!account) return;
  await revokeIfUnused(account);
  await KaigiGoogleAccount.deleteOne({ _id: account._id });
};

export const accountStatus = async (roomId) => {
  const account = await KaigiGoogleAccount.findOne({ roomId }).lean();
  if (!account) return { connected: false };
  const scopes = account.scopes ?? [];
  return {
    connected: true,
    email: account.email,
    // 同意画面でチェックを外された機能
    canCreateMeeting: scopes.includes(CALENDAR_SCOPE),
    canReadRecords: scopes.includes(MEET_SCOPE),
  };
};

// ===== Google API の呼び出し =====

const authorizedClient = async (roomId, scope) => {
  const account = await KaigiGoogleAccount.findOne({ roomId });
  if (!account) {
    throw new KaigiGoogleError(409, "Google アカウントが連携されていません");
  }
  if (!account.scopes.includes(scope)) {
    throw new KaigiGoogleError(
      409,
      "この操作に必要な権限が許可されていません。Google アカウントを連携し直してください"
    );
  }
  const client = newClient();
  client.setCredentials({
    refresh_token: decryptToken(account.refreshTokenEnc),
  });
  return { client, account };
};

const call = async ({ client, account }, options) => {
  try {
    const response = await client.request(options);
    return response.data;
  } catch (error) {
    const data = error?.response?.data;
    // 連携が取り消された・期限が切れた → 保存していたトークンは使えないので消す
    if (data?.error === "invalid_grant" || error?.message === "invalid_grant") {
      await KaigiGoogleAccount.deleteOne({ _id: account._id });
      throw new KaigiGoogleError(
        409,
        "Google との連携が切れています。もう一度連携してください"
      );
    }
    const status = error?.response?.status;
    console.error(
      `[kaigi/google] ${options.method ?? "GET"} ${options.url} failed (${status}):`,
      data?.error?.message ?? error.message
    );
    if (status === 403) {
      throw new KaigiGoogleError(
        502,
        "Google に操作を断られました（API が有効になっていないか、権限が足りません）"
      );
    }
    if (status === 404) {
      throw new KaigiGoogleError(404, "Google 側にデータが見つかりません");
    }
    throw new KaigiGoogleError(502, "Google との通信に失敗しました");
  }
};

const listAll = async (auth, url, key, { params = {}, max = 1000 } = {}) => {
  const items = [];
  let pageToken;
  do {
    const data = await call(auth, {
      url,
      params: { pageSize: 100, ...params, ...(pageToken ? { pageToken } : {}) },
    });
    items.push(...(data?.[key] ?? []));
    pageToken = data?.nextPageToken;
  } while (pageToken && items.length < max);
  return items.slice(0, max);
};

// ===== ① カレンダーに Meet 付きの予定を作る =====

// 画面にリンクとして出すので、Google のドメインの https のURLだけを残す
const googleUrl = (value, host) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host ? url.href : "";
  } catch {
    return "";
  }
};

const toMeeting = (event) => ({
  calendarEventId: event.id ?? "",
  calendarHtmlLink: googleUrl(event.htmlLink, "www.google.com"),
  meetUrl: googleUrl(
    event.hangoutLink ??
      event.conferenceData?.entryPoints?.find(
        (e) => e.entryPointType === "video"
      )?.uri,
    "meet.google.com"
  ),
  meetingCode: event.conferenceData?.conferenceId ?? "",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const eventUrl = (eventId) =>
  `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`;

const createEvent = async (auth, room, times, description) => {
  let event = await call(auth, {
    url: `${CALENDAR_API}/calendars/primary/events`,
    method: "POST",
    // conferenceDataVersion=1 がないと Meet が作られない
    params: { conferenceDataVersion: 1, sendUpdates: "none" },
    data: {
      summary: `いどばた会議室：${room.title}`,
      description,
      ...times,
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  // Meet の用意が終わっていなければ、少し待って読み直す
  for (
    let i = 0;
    i < 3 &&
    event.conferenceData?.createRequest?.status?.statusCode === "pending";
    i++
  ) {
    await sleep(1000 * (i + 1));
    event = await call(auth, { url: eventUrl(event.id) });
  }
  return event;
};

// 予定がすでにあれば日時だけ変える（Meet のURLは変わらない）。
// カレンダーで消されていたら作り直す
export const scheduleMeeting = async (
  room,
  { startAt, endAt, description }
) => {
  const auth = await authorizedClient(room._id, CALENDAR_SCOPE);
  const times = {
    start: { dateTime: startAt.toISOString() },
    end: { dateTime: endAt.toISOString() },
  };
  const existingId = room.meeting?.calendarEventId;

  let event = null;
  if (existingId) {
    try {
      event = await call(auth, {
        url: eventUrl(existingId),
        method: "PATCH",
        params: { sendUpdates: "none" },
        data: times,
      });
    } catch (error) {
      if (!(error instanceof KaigiGoogleError && error.status === 404)) {
        throw error;
      }
    }
    // 削除済みの予定は status が cancelled のまま返ることがある
    if (event?.status === "cancelled") event = null;
  }
  if (!event) event = await createEvent(auth, room, times, description);

  const meeting = toMeeting(event);
  if (!meeting.meetUrl || !meeting.meetingCode) {
    throw new KaigiGoogleError(
      502,
      "予定は作りましたが、Google Meet を用意できませんでした"
    );
  }
  room.set("meeting", {
    ...meeting,
    startAt,
    endAt,
    recordsSyncedAt: room.meeting?.recordsSyncedAt ?? null,
  });
  await room.save();
  return room.meeting;
};

export const cancelMeeting = async (room) => {
  const eventId = room.meeting?.calendarEventId;
  if (eventId) {
    const auth = await authorizedClient(room._id, CALENDAR_SCOPE);
    try {
      await call(auth, {
        url: eventUrl(eventId),
        method: "DELETE",
        params: { sendUpdates: "none" },
      });
    } catch (error) {
      // カレンダーで先に消されていれば、こちらの記録だけ消す
      if (!(error instanceof KaigiGoogleError && error.status === 404)) {
        throw error;
      }
    }
  }
  room.set("meeting", {});
  await room.save();
};

// ===== ② 文字起こしと録画を取り込む =====

const toDate = (value) => (value ? new Date(value) : null);

const speakerName = (participant) =>
  participant?.signedinUser?.displayName ??
  participant?.anonymousUser?.displayName ??
  participant?.phoneUser?.displayName ??
  "";

const syncOneRecord = async (auth, room, record) => {
  const [participants, transcripts, recordings] = await Promise.all([
    listAll(auth, `${MEET_API}/${record.name}/participants`, "participants"),
    listAll(auth, `${MEET_API}/${record.name}/transcripts`, "transcripts"),
    listAll(auth, `${MEET_API}/${record.name}/recordings`, "recordings"),
  ]);
  const names = new Map(participants.map((p) => [p.name, speakerName(p)]));

  const transcriptDocs = [];
  for (const t of transcripts) {
    // 会議中（STARTED）の文字起こしは、まだ発言がそろっていない
    const entries =
      t.state === "STARTED"
        ? []
        : await listAll(
            auth,
            `${MEET_API}/${t.name}/entries`,
            "transcriptEntries",
            {
              max: MAX_ENTRIES,
            }
          );
    transcriptDocs.push({
      name: t.name,
      state: t.state ?? "",
      docsUrl: googleUrl(t.docsDestination?.exportUri, "docs.google.com"),
      entries: entries.map((e) => ({
        speaker: names.get(e.participant) ?? "",
        text: e.text ?? "",
        startTime: toDate(e.startTime),
      })),
    });
  }

  await KaigiMeetRecord.findOneAndUpdate(
    { conferenceRecord: record.name },
    {
      roomId: room._id,
      conferenceRecord: record.name,
      startTime: toDate(record.startTime),
      endTime: toDate(record.endTime),
      transcripts: transcriptDocs,
      recordings: recordings.map((r) => ({
        name: r.name,
        state: r.state ?? "",
        driveFileId: r.driveDestination?.file ?? "",
        url: googleUrl(r.driveDestination?.exportUri, "drive.google.com"),
      })),
      expiresAt: room.expiresAt,
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export const syncRecords = async (room) => {
  const code = room.meeting?.meetingCode;
  if (!code || !MEETING_CODE.test(code)) {
    throw new KaigiGoogleError(409, "先に Google Meet の予定を作ってください");
  }
  const auth = await authorizedClient(room._id, MEET_SCOPE);
  const records = await listAll(
    auth,
    `${MEET_API}/conferenceRecords`,
    "conferenceRecords",
    {
      params: { filter: `space.meeting_code = "${code}"` },
      max: MAX_RECORDS,
    }
  );
  for (const record of records) {
    await syncOneRecord(auth, room, record);
  }
  room.meeting.recordsSyncedAt = new Date();
  await room.save();
  return listRecords(room._id);
};

export const listRecords = (roomId) =>
  KaigiMeetRecord.find({ roomId }).sort({ startTime: 1 }).lean();
