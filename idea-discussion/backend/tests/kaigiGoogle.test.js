import crypto from "node:crypto";
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

// Google の代わり。OAuth2Client が送る要求を記録し、URL ごとに決めた応答を返す
const google = vi.hoisted(() => ({
  requests: [],
  revoked: [],
  tokens: null,
  idPayload: null,
  routes: {},
  failRefresh: false,
}));

vi.mock("google-auth-library", () => {
  class OAuth2Client {
    constructor(options) {
      this.options = options;
      this.credentials = {};
    }
    async generateCodeVerifierAsync() {
      return { codeVerifier: "verifier-1", codeChallenge: "challenge-1" };
    }
    generateAuthUrl(opts) {
      const params = new URLSearchParams({
        ...opts,
        scope: opts.scope.join(" "),
        client_id: this.options.clientId,
        redirect_uri: this.options.redirectUri,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    async getToken({ code, codeVerifier }) {
      google.requests.push({ url: "token", code, codeVerifier });
      return { tokens: google.tokens };
    }
    async verifyIdToken({ idToken, audience }) {
      expect(audience).toBe("client-id");
      expect(idToken).toBe(google.tokens.id_token);
      return { getPayload: () => google.idPayload };
    }
    setCredentials(credentials) {
      this.credentials = credentials;
    }
    async revokeToken(token) {
      google.revoked.push(token);
    }
    async request({ url, method = "GET", params = {}, data }) {
      if (google.failRefresh) {
        const error = new Error("invalid_grant");
        error.response = { status: 400, data: { error: "invalid_grant" } };
        throw error;
      }
      google.requests.push({
        url,
        method,
        params,
        data,
        refreshToken: this.credentials.refresh_token,
      });
      const handler = google.routes[`${method} ${url}`];
      if (!handler) {
        const error = new Error("not found");
        error.response = { status: 404, data: {} };
        throw error;
      }
      return { data: handler({ params, data }) };
    }
  }
  return { OAuth2Client, CodeChallengeMethod: { S256: "S256" } };
});

// お題の作成時に動く AI（みんなの声の候補づくり）は使わない
vi.mock("../services/kaigi/llm.js", () => ({
  kaigiLLM: async () => ({}),
}));

process.env.KAIGI_HOST_PASSWORD = "test-password";
process.env.GOOGLE_CLIENT_ID = "client-id";
process.env.GOOGLE_CLIENT_SECRET = "client-secret";
process.env.KAIGI_GOOGLE_REDIRECT_URI =
  "http://localhost:3000/api/kaigi/google/callback";
process.env.KAIGI_GOOGLE_TOKEN_KEY = crypto.randomBytes(32).toString("base64");
process.env.KAIGI_FRONTEND_URL = "https://front.example";

const { default: kaigiRoutes } = await import("../routes/kaigiRoutes.js");

const MONGO_URI =
  process.env.KAIGI_TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/kaigi_google_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const MEET = "https://meet.googleapis.com/v2";
const ALL_SCOPES =
  "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/meetings.space.readonly";

describe.skipIf(!mongoAvailable)("kaigi Google integration", () => {
  let server;
  let base;

  const call = async (method, path, body, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      redirect: "manual",
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const location = response.headers.get("location");
    const json = location ? null : await response.json().catch(() => null);
    return { status: response.status, body: json, location };
  };

  const createRoom = async () => {
    const res = await call(
      "POST",
      "/host/rooms",
      { title: "共用自転車をどうするか", background: "背景", capacity: 5 },
      { "x-kaigi-password": "test-password" }
    );
    expect(res.status).toBe(201);
    return {
      roomId: res.body.id,
      key: { "x-kaigi-host-key": res.body.hostKey },
    };
  };

  // Google の連携画面を通ったことにして、戻ってくるところまで進める
  const connect = async (roomId, key, sub = "google-sub-1") => {
    const res = await call(
      "POST",
      `/rooms/${roomId}/host/google/connect`,
      {},
      key
    );
    expect(res.status).toBe(200);
    const url = new URL(res.body.url);
    google.tokens = {
      refresh_token: `refresh-${sub}`,
      id_token: "id-token",
      scope: ALL_SCOPES,
    };
    google.idPayload = { sub, email: `${sub}@example.com` };
    return call(
      "GET",
      `/google/callback?code=auth-code&state=${url.searchParams.get("state")}`
    );
  };

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    for (const name of [
      "KaigiGoogleAccount",
      "KaigiOAuthState",
      "KaigiMeetRecord",
    ]) {
      await mongoose.model(name).syncIndexes();
    }
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
    google.requests = [];
    google.revoked = [];
    google.routes = {};
    google.failRefresh = false;
  });

  it("refuses the fallback host password in production", async () => {
    const saved = {
      password: process.env.KAIGI_HOST_PASSWORD,
      env: process.env.NODE_ENV,
    };
    try {
      process.env.KAIGI_HOST_PASSWORD = "";
      process.env.NODE_ENV = "production";
      const res = await call(
        "POST",
        "/host/verify",
        {},
        { "x-kaigi-password": "dd" }
      );
      expect(res.status).toBe(503);
    } finally {
      process.env.KAIGI_HOST_PASSWORD = saved.password;
      process.env.NODE_ENV = saved.env;
    }
  });

  it("protects the host page with the per-room key", async () => {
    const { roomId, key } = await createRoom();
    const other = await createRoom();
    expect((await call("GET", `/rooms/${roomId}/host`)).status).toBe(403);
    expect(
      (await call("GET", `/rooms/${roomId}/host`, undefined, other.key)).status
    ).toBe(403);
    expect(
      (await call("GET", "/rooms/not-an-id/host", undefined, key)).status
    ).toBe(403);

    const res = await call("GET", `/rooms/${roomId}/host`, undefined, key);
    expect(res.status).toBe(200);
    expect(res.body.google).toEqual({ available: true, connected: false });
    expect(res.body.meeting).toBeNull();

    // 鍵のハッシュは公開の応答に出さない
    const pub = await call("GET", `/rooms/${roomId}`);
    expect(JSON.stringify(pub.body)).not.toContain("hostKey");
  });

  it("connects a Google account with state and PKCE, storing the token encrypted", async () => {
    const { roomId, key } = await createRoom();
    const start = await call(
      "POST",
      `/rooms/${roomId}/host/google/connect`,
      {},
      key
    );
    const url = new URL(start.body.url);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).toContain("meetings.space.readonly");

    // 知らない state は受け付けない
    const forged = await call("GET", "/google/callback?code=x&state=forged");
    expect(forged.location).toBe("https://front.example/kaigi?google=failed");

    const done = await connect(roomId, key);
    expect(done.status).toBe(303);
    expect(done.location).toBe(
      `https://front.example/kaigi/${roomId}/host?google=connected`
    );
    expect(google.requests[0]).toMatchObject({
      code: "auth-code",
      codeVerifier: "verifier-1",
    });

    const stored = await mongoose
      .model("KaigiGoogleAccount")
      .findOne({ roomId })
      .lean();
    expect(stored.refreshTokenEnc).not.toContain("refresh-google-sub-1");
    expect(stored.email).toBe("google-sub-1@example.com");

    const view = await call("GET", `/rooms/${roomId}/host`, undefined, key);
    expect(view.body.google).toMatchObject({
      connected: true,
      email: "google-sub-1@example.com",
      canCreateMeeting: true,
      canReadRecords: true,
    });
  });

  it("sends a cancelled consent back to the room only with a valid state", async () => {
    const { roomId, key } = await createRoom();
    const start = await call(
      "POST",
      `/rooms/${roomId}/host/google/connect`,
      {},
      key
    );
    const state = new URL(start.body.url).searchParams.get("state");
    const res = await call(
      "GET",
      `/google/callback?error=access_denied&state=${state}`
    );
    expect(res.location).toBe(
      `https://front.example/kaigi/${roomId}/host?google=cancelled`
    );
    // 一度使った state は使えない
    const again = await call("GET", `/google/callback?code=x&state=${state}`);
    expect(again.location).toBe("https://front.example/kaigi?google=failed");
  });

  it("creates a calendar event with Google Meet and shows the link to participants", async () => {
    const { roomId, key } = await createRoom();
    await connect(roomId, key);

    google.routes[`POST ${CAL}`] = ({ params, data }) => {
      expect(params.conferenceDataVersion).toBe(1);
      expect(data.conferenceData.createRequest.conferenceSolutionKey.type).toBe(
        "hangoutsMeet"
      );
      expect(data.description).toContain(
        `https://front.example/kaigi/${roomId}`
      );
      return {
        id: "event-1",
        htmlLink: "https://www.google.com/calendar/event?eid=1",
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        conferenceData: { conferenceId: "abc-defg-hij" },
      };
    };

    const bad = await call(
      "PUT",
      `/rooms/${roomId}/host/meeting`,
      { startAt: "not a date", durationMinutes: 60 },
      key
    );
    expect(bad.status).toBe(400);

    const startAt = new Date(Date.now() + 86400000).toISOString();
    const res = await call(
      "PUT",
      `/rooms/${roomId}/host/meeting`,
      { startAt, durationMinutes: 60 },
      key
    );
    expect(res.status).toBe(200);
    expect(res.body.meeting).toMatchObject({
      meetUrl: "https://meet.google.com/abc-defg-hij",
      meetingCode: "abc-defg-hij",
      calendarHtmlLink: "https://www.google.com/calendar/event?eid=1",
    });
    expect(google.requests.at(-1).refreshToken).toBe("refresh-google-sub-1");

    const pub = await call("GET", `/rooms/${roomId}`);
    expect(pub.body.room.meeting).toEqual({
      meetUrl: "https://meet.google.com/abc-defg-hij",
      startAt,
      endAt: new Date(new Date(startAt).getTime() + 3600000).toISOString(),
    });
    expect(JSON.stringify(pub.body)).not.toContain("event-1");

    // 2回目は同じ予定の日時を変える
    google.routes[`PATCH ${CAL}/event-1`] = ({ data }) => {
      expect(data.conferenceData).toBeUndefined();
      return {
        id: "event-1",
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        conferenceData: { conferenceId: "abc-defg-hij" },
      };
    };
    const moved = await call(
      "PUT",
      `/rooms/${roomId}/host/meeting`,
      { startAt, durationMinutes: 30 },
      key
    );
    expect(moved.status).toBe(200);
    expect(google.requests.at(-1).method).toBe("PATCH");
  });

  it("imports transcripts and recordings from Google Meet", async () => {
    const { roomId, key } = await createRoom();
    await connect(roomId, key);
    google.routes[`POST ${CAL}`] = () => ({
      id: "event-2",
      hangoutLink: "https://meet.google.com/xyz-abcd-efg",
      conferenceData: { conferenceId: "xyz-abcd-efg" },
    });
    await call(
      "PUT",
      `/rooms/${roomId}/host/meeting`,
      { startAt: new Date().toISOString(), durationMinutes: 60 },
      key
    );

    const rec = "conferenceRecords/rec-1";
    google.routes[`GET ${MEET}/conferenceRecords`] = ({ params }) => {
      expect(params.filter).toBe('space.meeting_code = "xyz-abcd-efg"');
      return {
        conferenceRecords: [
          {
            name: rec,
            startTime: "2026-10-20T01:00:00Z",
            endTime: "2026-10-20T02:00:00Z",
          },
        ],
      };
    };
    google.routes[`GET ${MEET}/${rec}/participants`] = () => ({
      participants: [
        {
          name: `${rec}/participants/p1`,
          signedinUser: { displayName: "はなこ" },
        },
        {
          name: `${rec}/participants/p2`,
          anonymousUser: { displayName: "ゲスト" },
        },
      ],
    });
    google.routes[`GET ${MEET}/${rec}/transcripts`] = () => ({
      transcripts: [
        {
          name: `${rec}/transcripts/t1`,
          state: "FILE_GENERATED",
          docsDestination: {
            exportUri: "https://docs.google.com/document/d/t1",
          },
        },
        {
          // Google 以外のURLはリンクにしない
          name: `${rec}/transcripts/t2`,
          state: "STARTED",
          docsDestination: { exportUri: "javascript:alert(1)" },
        },
      ],
    });
    // 発言は2ページに分かれて返る
    google.routes[`GET ${MEET}/${rec}/transcripts/t1/entries`] = ({
      params,
    }) =>
      params.pageToken
        ? {
            transcriptEntries: [
              { participant: `${rec}/participants/p2`, text: "賛成です" },
            ],
          }
        : {
            transcriptEntries: [
              {
                participant: `${rec}/participants/p1`,
                text: "登録制にしましょう",
                startTime: "2026-10-20T01:01:00Z",
              },
            ],
            nextPageToken: "next",
          };
    google.routes[`GET ${MEET}/${rec}/recordings`] = () => ({
      recordings: [
        {
          name: `${rec}/recordings/r1`,
          state: "FILE_GENERATED",
          driveDestination: {
            file: "drive-file-1",
            exportUri: "https://drive.google.com/file/d/drive-file-1/view",
          },
        },
      ],
    });

    const res = await call(
      "POST",
      `/rooms/${roomId}/host/records/sync`,
      {},
      key
    );
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    const [record] = res.body.records;
    expect(record.transcripts[0].docsUrl).toBe(
      "https://docs.google.com/document/d/t1"
    );
    expect(record.transcripts[1]).toMatchObject({ docsUrl: "", entries: [] });
    expect(
      record.transcripts[0].entries.map((e) => [e.speaker, e.text])
    ).toEqual([
      ["はなこ", "登録制にしましょう"],
      ["ゲスト", "賛成です"],
    ]);
    expect(record.recordings[0].url).toBe(
      "https://drive.google.com/file/d/drive-file-1/view"
    );

    // 2回目の取り込みでも重複しない
    await call("POST", `/rooms/${roomId}/host/records/sync`, {}, key);
    const list = await call(
      "GET",
      `/rooms/${roomId}/host/records`,
      undefined,
      key
    );
    expect(list.body.records).toHaveLength(1);

    // 文字起こしはホストだけが読める
    expect((await call("GET", `/rooms/${roomId}/host/records`)).status).toBe(
      403
    );
  });

  it("forgets the account when Google rejects the refresh token", async () => {
    const { roomId, key } = await createRoom();
    await connect(roomId, key);
    google.failRefresh = true;
    const res = await call(
      "PUT",
      `/rooms/${roomId}/host/meeting`,
      { startAt: new Date().toISOString(), durationMinutes: 60 },
      key
    );
    expect(res.status).toBe(409);
    const view = await call("GET", `/rooms/${roomId}/host`, undefined, key);
    expect(view.body.google.connected).toBe(false);
  });

  it("revokes the grant on disconnect only when no other room uses the account", async () => {
    const a = await createRoom();
    const b = await createRoom();
    await connect(a.roomId, a.key, "shared-sub");
    await connect(b.roomId, b.key, "shared-sub");

    await call("DELETE", `/rooms/${a.roomId}/host/google`, undefined, a.key);
    expect(google.revoked).toEqual([]);
    await call("DELETE", `/rooms/${b.roomId}/host/google`, undefined, b.key);
    expect(google.revoked).toEqual(["refresh-shared-sub"]);
  });
});
