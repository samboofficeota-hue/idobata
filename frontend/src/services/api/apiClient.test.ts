import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";

describe("apiClient.sendMessage のリトライ", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("サーバーエラー（500）では再送しない", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.sendMessage("user1", "こんにちは", "theme1");

    expect(result.isOk()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("サーバーに届いていない通信エラーは再送する", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(
        new Response(
          JSON.stringify({ response: "ok", threadId: "t1", userId: "user1" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.sendQuestionMessage(
      "user1",
      "こんにちは",
      "theme1",
      "question1"
    );

    expect(result.isOk()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
