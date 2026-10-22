import { describe, expect, it } from "vitest";
import { needsRefresh } from "../services/kaigi/overview.js";
import { buildTurnSystemPrompt } from "../services/kaigi/prompts.js";
import {
  canAiAdvance,
  missingToLeave,
  stepTiming,
} from "../services/kaigi/steps.js";
import {
  buildTranscribePrompt,
  cleanTranscript,
  detectAudioExtension,
} from "../services/kaigi/transcribe.js";
import { applyTurn, normalizeTurn } from "../services/kaigi/turn.js";

const makeSession = (overrides = {}) => ({
  nickname: "たろう",
  step: 4,
  startedAt: new Date("2026-10-14T10:00:00Z"),
  messages: [],
  outputs: { domain: "", issue: "", solution: "" },
  ...overrides,
});

describe("steps", () => {
  it("lists the outputs still needed to leave a step", () => {
    expect(missingToLeave(5, { issue: "" })).toEqual(["issue"]);
    expect(missingToLeave(8, { domain: "駐輪場", issue: "  " })).toEqual([
      "issue",
      "solution",
    ]);
    expect(missingToLeave(4, {})).toEqual([]);
  });

  it("lets the AI advance only through the discussion steps before 8", () => {
    expect(canAiAdvance(2)).toBe(true);
    expect(canAiAdvance(3)).toBe(false);
    expect(canAiAdvance(7)).toBe(true);
    expect(canAiAdvance(8)).toBe(false);
  });

  it("computes remaining time from the start of the 20 minutes", () => {
    const session = makeSession({ step: 4 });
    const now = new Date("2026-10-14T10:06:00Z");
    expect(stepTiming(session, now)).toEqual({
      totalRemainingSec: 14 * 60,
      stepRemainingSec: 3 * 60,
      overtime: false,
    });
    expect(stepTiming({ step: 1 }, now)).toMatchObject({
      totalRemainingSec: 20 * 60,
      stepRemainingSec: null,
    });
    const late = new Date("2026-10-14T10:21:00Z");
    expect(stepTiming(session, late).overtime).toBe(true);
  });
});

describe("normalizeTurn", () => {
  it("keeps step 2 one-on-one with the facilitator", () => {
    const turn = normalizeTurn(
      { speaker: "member2", content: "それはなぜですか？", advance: false },
      2
    );
    expect(turn.speaker).toBe("facilitator");
  });

  it("drops captures the step is not allowed to make", () => {
    const turn = normalizeTurn(
      {
        speaker: "member1",
        content: "どれが一番大事ですか？",
        capture: { issue: " 放置自転車で通路がふさがる ", solution: "撤去" },
      },
      5
    );
    expect(turn.capture).toEqual({ issue: "放置自転車で通路がふさがる" });
  });

  it("falls back to a facilitator line when the reply is empty", () => {
    const turn = normalizeTurn({ speaker: "nobody", content: "  " }, 6);
    expect(turn.speaker).toBe("facilitator");
    expect(turn.content).not.toBe("");
    expect(turn.advance).toBe(false);
  });
});

describe("applyTurn", () => {
  it("does not advance past step 5 until the issue is written down", () => {
    const session = makeSession({ step: 5 });
    const blocked = applyTurn(session, {
      speaker: "facilitator",
      content: "課題は？",
      capture: {},
      advance: true,
    });
    expect(blocked.advanced).toBe(false);
    expect(session.step).toBe(5);

    const moved = applyTurn(session, {
      speaker: "facilitator",
      content: "では、アイディアを出しましょう。",
      capture: { issue: "高齢者が買い物に行けない" },
      advance: true,
    });
    expect(moved.advanced).toBe(true);
    expect(session.step).toBe(6);
    expect(session.outputs.issue).toBe("高齢者が買い物に行けない");
    expect(session.messages).toHaveLength(2);
  });

  it("leaves the final decision in step 8 to the participant", () => {
    const session = makeSession({
      step: 8,
      outputs: { domain: "a", issue: "b", solution: "c" },
    });
    const result = applyTurn(session, {
      speaker: "facilitator",
      content: "決まりましたね。",
      capture: {},
      advance: true,
    });
    expect(result.advanced).toBe(false);
    expect(session.step).toBe(8);
  });
});

describe("needsRefresh", () => {
  const now = new Date("2026-10-14T10:10:00Z");

  it("builds the overview once, then only when new voices arrive after a minute", () => {
    expect(needsRefresh(undefined, 0, now)).toBe(true);
    const overview = {
      voiceCount: 3,
      updatedAt: new Date("2026-10-14T10:09:30Z"),
    };
    expect(needsRefresh(overview, 3, now)).toBe(false);
    expect(needsRefresh(overview, 4, now)).toBe(false);
    expect(
      needsRefresh(
        { ...overview, updatedAt: new Date("2026-10-14T10:08:00Z") },
        4,
        now
      )
    ).toBe(true);
  });
});

describe("buildTurnSystemPrompt", () => {
  const room = {
    title: "共用自転車をどうするか",
    background: "利用が減っている",
    overview: {
      issueCandidates: ["放置自転車が通路をふさぐ"],
      ideaCandidates: [],
      conflicts: [],
      agreements: [],
      updatedAt: new Date(),
    },
  };

  it("offers only the facilitator in step 2", () => {
    const prompt = buildTurnSystemPrompt({
      room,
      session: makeSession({ step: 2 }),
    });
    expect(prompt).toContain("共用自転車をどうするか");
    expect(prompt).toContain('"speaker": "facilitator"');
    expect(prompt).not.toContain("ミナミ");
    expect(prompt).not.toContain("放置自転車が通路をふさぐ");
  });

  it("brings in the three members and the overview from step 4", () => {
    const prompt = buildTurnSystemPrompt({
      room,
      session: makeSession({ step: 4 }),
    });
    expect(prompt).toContain(
      '"speaker": "facilitator | member1 | member2 | member3"'
    );
    expect(prompt).toContain("ミナミ");
    expect(prompt).toContain("放置自転車が通路をふさぐ");
  });
});

describe("transcribe", () => {
  const head = (...parts) =>
    Buffer.concat([
      ...parts.map((p) =>
        typeof p === "string" ? Buffer.from(p, "latin1") : Buffer.from(p)
      ),
      Buffer.alloc(16),
    ]);

  it("detects the recording formats phones produce from the file contents", () => {
    // Android Chrome（webm）と iPhone Safari（mp4）
    expect(detectAudioExtension(head([0x1a, 0x45, 0xdf, 0xa3]))).toBe("webm");
    expect(detectAudioExtension(head([0, 0, 0, 0x1c], "ftypM4A "))).toBe("mp4");
    expect(detectAudioExtension(head("OggS"))).toBe("ogg");
    expect(detectAudioExtension(head("RIFF", [0, 0, 0, 0], "WAVE"))).toBe(
      "wav"
    );
    // 画像や短すぎるものは断る
    expect(detectAudioExtension(head([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectAudioExtension(Buffer.from([0x1a, 0x45]))).toBeNull();
  });

  it("gives the topic and the last AI question as hints", () => {
    const prompt = buildTranscribePrompt(
      { title: "共用自転車をどうするか", background: "利用が減っている" },
      makeSession({
        messages: [
          { speaker: "facilitator", content: "最初の問い" },
          { speaker: "member1", content: "駐輪場で困ったことは？" },
          { speaker: "user", content: "あります" },
        ],
      })
    );
    expect(prompt).toContain("共用自転車をどうするか");
    expect(prompt).toContain("利用が減っている");
    expect(prompt).toContain("駐輪場で困ったことは？");
    expect(prompt).not.toContain("最初の問い");
    expect(prompt).not.toContain("あります");
  });

  it("keeps the hint short even with a long background", () => {
    const prompt = buildTranscribePrompt(
      { title: "お題", background: "あ".repeat(4000) },
      makeSession()
    );
    expect(prompt.length).toBeLessThan(400);
  });

  it("drops phrases returned for silence, but keeps real speech", () => {
    expect(cleanTranscript("ご視聴ありがとうございました。")).toBe("");
    expect(cleanTranscript("  。 ")).toBe("");
    expect(
      cleanTranscript("以下は、参加者がこれについて話した内容です。")
    ).toBe("");
    expect(cleanTranscript(" 駐輪場が狭いと思います。 ")).toBe(
      "駐輪場が狭いと思います。"
    );
    // 定型文を含んでいても、ほかに話した内容があれば残す
    expect(
      cleanTranscript("動画のご視聴ありがとうございましたと言われても困る")
    ).toBe("動画のご視聴ありがとうございましたと言われても困る");
  });
});
