import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("getUserSession", () => {
  it("sends the old device id and stores the signed token", async () => {
    store.set("userId", "legacy-id");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ userId: "legacy-id", token: "signed" }));
    vi.stubGlobal("fetch", fetchMock);
    const { getUserSession, userTokenHeader } = await import("./userSession");

    expect(await getUserSession()).toEqual({
      userId: "legacy-id",
      token: "signed",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      userId: "legacy-id",
    });
    expect(store.get("idobataUserToken")).toBe("signed");
    // 2回目からはサーバーに問い合わせない
    expect(await userTokenHeader()).toEqual({ "x-user-token": "signed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the stored token so the server keeps the same id", async () => {
    store.set("idobataUserId", "u1");
    store.set("idobataUserToken", "tok");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ userId: "u1", token: "tok" }));
    vi.stubGlobal("fetch", fetchMock);
    const { getUserSession } = await import("./userSession");
    await getUserSession();
    expect(fetchMock.mock.calls[0][1].headers["x-user-token"]).toBe("tok");
  });

  it("falls back to the local id and retries later when the server is down", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(ok({ userId: "server-id", token: "t" }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getUserSession } = await import("./userSession");

    const first = await getUserSession();
    expect(first.token).toBe("");
    expect(store.get("idobataUserId")).toBe(first.userId);
    expect((await getUserSession()).token).toBe("t");
  });
});
