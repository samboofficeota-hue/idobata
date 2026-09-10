import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

// OpenAI クライアントを差し替える。llmService は初回呼び出し時に1度だけ new する
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { DEFAULT_MODEL, callLLM, testLLM } from "./llmService.js";

const originalEnv = { ...process.env };

/** Chat Completions のレスポンスを組み立てる */
function completion(content, { finishReason = "stop", reasoning = 0 } = {}) {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      completion_tokens_details: { reasoning_tokens: reasoning },
      prompt_tokens_details: { cached_tokens: 0 },
    },
  };
}

describe("llmService", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-key" };
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("callLLM", () => {
    it("テキストを返し、既定では思考なし・出力上限2048で呼ぶ", async () => {
      mockCreate.mockResolvedValue(completion("こんにちは"));

      const result = await callLLM([{ role: "user", content: "やあ" }]);

      expect(result).toBe("こんにちは");
      expect(mockCreate).toHaveBeenCalledWith({
        model: DEFAULT_MODEL,
        messages: [{ role: "user", content: "やあ" }],
        max_completion_tokens: 2048,
        reasoning_effort: "none",
      });
    });

    it("max_tokens は max_completion_tokens に渡り、reasoning_effort は上書きできる", async () => {
      mockCreate.mockResolvedValue(completion("ok"));

      await callLLM([{ role: "user", content: "x" }], false, "other-model", {
        max_tokens: 600,
        reasoning_effort: "low",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "other-model",
          max_completion_tokens: 600,
          reasoning_effort: "low",
        })
      );
      expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("max_tokens");
    });

    it("system メッセージはそのまま messages に含めて渡す", async () => {
      mockCreate.mockResolvedValue(completion("ok"));
      const messages = [
        { role: "system", content: "S" },
        { role: "user", content: "U" },
      ];

      await callLLM(messages);

      expect(mockCreate.mock.calls[0][0].messages).toEqual(messages);
    });

    it("JSON 出力では json_object を指定し、最後の user メッセージに JSON の指示を足して解析する", async () => {
      mockCreate.mockResolvedValue(completion('{"a":1}'));
      const messages = [{ role: "user", content: "教えて" }];

      const result = await callLLM(messages, true);

      expect(result).toEqual({ a: 1 });
      const options = mockCreate.mock.calls[0][0];
      expect(options.response_format).toEqual({ type: "json_object" });
      expect(options.messages[0].content).toContain("JSON");
    });

    it("```json のコードブロックに包まれた JSON も解析できる", async () => {
      mockCreate.mockResolvedValue(completion('```json\n{"b":2}\n```'));

      await expect(
        callLLM([{ role: "user", content: "x" }], true)
      ).resolves.toEqual({ b: 2 });
    });

    it("壊れた JSON はエラーにする", async () => {
      mockCreate.mockResolvedValue(completion("not json"));

      await expect(
        callLLM([{ role: "user", content: "x" }], true)
      ).rejects.toThrow("LLM did not return valid JSON");
    });

    it("返答が空ならエラーにする（思考が出力上限を使い切った場合など）", async () => {
      mockCreate.mockResolvedValue(
        completion(null, { finishReason: "length", reasoning: 600 })
      );

      await expect(
        callLLM([{ role: "user", content: "x" }], false, undefined, {
          max_tokens: 600,
        })
      ).rejects.toThrow("LLM returned empty content");
    });

    it("出力上限で打ち切られたら TRUNCATED を警告し、本文は返す", async () => {
      mockCreate.mockResolvedValue(
        completion("途中まで", { finishReason: "length" })
      );

      const result = await callLLM([{ role: "user", content: "x" }]);

      expect(result).toBe("途中まで");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("TRUNCATED")
      );
    });

    it("1回の呼び出しにつき1行のログを出す", async () => {
      mockCreate.mockResolvedValue(completion("ok"));

      await callLLM([{ role: "user", content: "x" }]);

      const lines = console.log.mock.calls.map((c) => String(c[0]));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(
        /^\[llmService\] model=\S+ max=2048 msgs=1 thinking=none stop=stop in=10 cached=0 out=5 think=0 ms=\d+$/
      );
    });

    it("API エラーはステータス付きの1行を出してそのまま投げ直す", async () => {
      const apiError = Object.assign(new Error("Rate limit"), { status: 429 });
      mockCreate.mockRejectedValue(apiError);

      await expect(callLLM([{ role: "user", content: "x" }])).rejects.toBe(
        apiError
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(/Error calling LLM: .* status=429 Rate limit/)
      );
    });

    it("OPENAI_API_KEY がなければ呼ばずにエラーにする", async () => {
      process.env.OPENAI_API_KEY = "";

      await expect(callLLM([{ role: "user", content: "x" }])).rejects.toThrow(
        "OPENAI_API_KEY"
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("testLLM", () => {
    it("接続テストの返答を返す", async () => {
      mockCreate.mockResolvedValue(completion("Hello!"));

      await expect(testLLM()).resolves.toBe("Hello!");
    });

    it("OPENAI_API_KEY がなければ何もせずに終わる", async () => {
      process.env.OPENAI_API_KEY = "";

      await expect(testLLM()).resolves.toBeUndefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
