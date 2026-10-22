import { describe, expect, it } from "vitest";
import { enforceMix, normalizeCast } from "../services/kaigi/cast.js";
import { needsRefresh } from "../services/kaigi/overview.js";
import {
  normalizePersonas,
  resolveMembers,
} from "../services/kaigi/personas.js";
import {
  buildHistory,
  buildSessionBlock,
  buildTurnContext,
  buildTurnSystemPrompt,
  speakerBalance,
} from "../services/kaigi/prompts.js";
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
import {
  applyJudgment,
  applyTurn,
  buildMessages,
  normalizeTurn,
} from "../services/kaigi/turn.js";

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

describe("turn messages", () => {
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
  const at = (min) =>
    new Date(Date.parse("2026-10-14T10:00:00Z") + min * 60000);

  it("keeps the head of the prompt the same through the 20 minutes", () => {
    const early = makeSession({ step: 2, intensity: "normal" });
    const late = makeSession({
      step: 7,
      intensity: "strict",
      outputs: { domain: "駐輪場", issue: "通路がふさがる", solution: "" },
    });
    // 工程・残り時間・強さ・決まったことが変わっても、先頭は1文字も変わらない
    const head = buildTurnSystemPrompt({ room, session: early });
    expect(buildTurnSystemPrompt({ room, session: late })).toBe(head);
    expect(head).toContain("共用自転車をどうするか");
    expect(head).not.toContain("放置自転車が通路をふさぐ");

    // 並びは「先頭 → 会話の履歴 → 毎回変わる情報」
    const messages = buildMessages(
      room,
      { ...late, messages: [{ speaker: "user", content: "暗い", step: 7 }] },
      { event: "reply", now: at(14) }
    );
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "system"]);
    expect(messages[0].content).toBe(head);
    expect(messages[2].content).toContain("工程7「行ったり来たり」");
  });

  it("offers only the facilitator in step 2", () => {
    const context = buildTurnContext({
      room,
      session: makeSession({ step: 2 }),
      now: at(1),
    });
    expect(context).toContain('"speaker": "facilitator"');
    expect(context).not.toContain("ミナミ");
    expect(context).not.toContain("放置自転車が通路をふさぐ");
    expect(context).not.toContain("今の強さ");
  });

  it("brings in the three members and the overview from step 4", () => {
    const context = buildTurnContext({
      room,
      session: makeSession({ step: 4 }),
      now: at(7),
    });
    expect(context).toContain(
      '"speaker": "facilitator | member1 | member2 | member3"'
    );
    expect(context).toContain("ミナミ");
    expect(context).toContain("放置自転車が通路をふさぐ");
    expect(context).toContain("この工程：2分0秒");
  });
});

describe("personas", () => {
  it("keeps only the titles the AI gave, trimmed", () => {
    expect(
      normalizePersonas({
        member1: " 子育て中の住民 ",
        member2: "",
        member3: { title: "外の人" },
      })
    ).toEqual({ member1: { title: "子育て中の住民" } });
    expect(normalizePersonas(null)).toEqual({});
  });

  it("keeps the three fixed camps and adds the room's title", () => {
    const members = resolveMembers({
      personas: { member2: { title: "会計担当の元理事" } },
    });
    expect(members.member1).toMatchObject({
      name: "ミナミ",
      camp: "肯定派",
      label: "肯定派",
    });
    expect(members.member2).toMatchObject({
      name: "ケンジ",
      camp: "否定派",
      label: "否定派・会計担当の元理事",
    });
    expect(resolveMembers(undefined).member3).toMatchObject({
      name: "ソラ",
      camp: "未定派",
    });
  });
});

describe("speakerBalance", () => {
  const members = resolveMembers({});
  const said = (speaker, step = 6) => ({ speaker, content: "…", step });

  it("points to a member who has not spoken yet in the step", () => {
    const note = speakerBalance(
      makeSession({
        step: 4,
        messages: [said("facilitator", 4), said("user", 4), said("member1", 4)],
      }),
      members
    );
    expect(note).toContain("ミナミ 1回、ケンジ 0回、ソラ 0回");
    expect(note).toContain("直前に話したAI：ミナミ");
    expect(note).toContain("まだ話していないメンバー：ケンジ、ソラ");
  });

  it("reminds Sora to question the issue during step 6 until it happens", () => {
    const before = speakerBalance(
      makeSession({ step: 6, messages: [said("member1")] }),
      members
    );
    expect(before).toContain("ちゃぶ台返し");
    const after = speakerBalance(
      makeSession({ step: 6, messages: [said("member3")] }),
      members
    );
    expect(after).not.toContain("ちゃぶ台返し");
  });

  it("says nothing in the one-on-one step", () => {
    expect(speakerBalance(makeSession({ step: 2 }), members)).toBe("");
  });
});

describe("member prompts", () => {
  const room = {
    title: "共用自転車をどうするか",
    personas: { member1: { title: "子育て中の住民" } },
    overview: {
      issueCandidates: [],
      ideaCandidates: [],
      conflicts: ["今の対立点"],
      agreements: ["通路の安全は守る"],
      updatedAt: new Date(),
    },
  };

  it("describes the three camps, the room's titles and the intensity", () => {
    const session = makeSession({ step: 4, intensity: "strict" });
    const head = buildTurnSystemPrompt({ room, session });
    const tail = buildTurnContext({ room, session });
    expect(head).toContain(
      "member1：ミナミ（肯定派・子育て中の住民。全体として「賛成」に傾く）"
    );
    expect(head).toContain(
      "譲れないこと（何があっても変わらない）：引き受けた負担は誰かが必ず背負う"
    );
    expect(head).toContain(
      "member3：ソラ（未定派。全体として「決めかねる」に傾く）"
    );
    expect(head).toContain("判断の持ち方");
    expect(head).toContain("grill me");
    expect(tail).toContain("- member2：ケンジ（否定派）");
    expect(tail).toContain("# 今の強さ\nstrict");
    expect(tail).toContain("- 今の対立点");
    expect(tail).toContain('"read"');
  });

  it("keeps the axes the participant started step 4 with", () => {
    const session = makeSession({
      step: 6,
      overviewAtStart: {
        ...room.overview,
        conflicts: ["始めたときの対立点"],
      },
    });
    const tail = buildTurnContext({ room, session });
    expect(tail).toContain("- 始めたときの対立点");
    expect(tail).not.toContain("- 今の対立点");
  });

  it("puts the fixed theme axes between the head and the history", () => {
    const axesAtStart = {
      themeTitle: "共用自転車",
      items: [
        {
          key: "R1",
          proposition: "共用自転車を残すべきか",
          agreement: ["通路の安全は守る"],
          affirmative: "足になる",
          negative: "負担が大きい",
          undecidedReason: "数が分からない",
          voices: {
            affirmative: [],
            negative: [
              {
                kind: "課題",
                statement: "管理費がかさむ",
                reason: "毎年上がる",
              },
            ],
            undecided: [],
          },
        },
      ],
    };
    const session = makeSession({
      step: 6,
      axesAtStart,
      overviewAtStart: room.overview,
      messages: [{ speaker: "user", content: "暗い", step: 6 }],
    });
    const block = buildSessionBlock(session, room);
    expect(block).toContain("R1：共用自転車を残すべきか");
    expect(block).toContain("（課題）管理費がかさむ（理由：毎年上がる）");
    expect(block).toContain("別の場では");
    expect(buildSessionBlock({ ...session, step: 2 }, room)).toBe("");

    const messages = buildMessages(room, session, { event: "reply" });
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "system",
      "user",
      "system",
    ]);
    expect(messages[1].content).toBe(block);
    // 軸カードがあるときは、みんなの声の対立点を論点として扱わない
    expect(messages[3].content).not.toContain("論点（仮");
  });

  it("labels each AI line in the history with its name", () => {
    expect(
      buildHistory(
        [
          { speaker: "user", content: "暗いのが怖い" },
          { speaker: "member1", content: "いつ頃ですか？" },
          { speaker: "facilitator", content: "次へ進みます" },
        ],
        room
      )
    ).toEqual([
      { role: "user", content: "暗いのが怖い" },
      { role: "assistant", content: "【ミナミ】いつ頃ですか？" },
      { role: "assistant", content: "【ファシリ】次へ進みます" },
    ]);
  });
});

describe("cast", () => {
  const side = (s) => ({ side: s, because: "" });

  it("mixes the judgments: the lean is the most common, never all the same", () => {
    const keys = ["R1", "R2", "R3"];
    const all = (s) => ({ R1: side(s), R2: side(s), R3: side(s) });
    const sides = (j) => keys.map((k) => j[k].side);

    expect(sides(enforceMix(all("affirmative"), keys, "affirmative"))).toEqual([
      "affirmative",
      "affirmative",
      "undecided",
    ]);
    expect(sides(enforceMix(all("undecided"), keys, "undecided"))).toEqual([
      "undecided",
      "undecided",
      "affirmative",
    ]);
    // 傾きが一番多くなるよう直す
    expect(sides(enforceMix(all("negative"), keys, "affirmative"))).toEqual([
      "affirmative",
      "affirmative",
      "negative",
    ]);
    // すでに混ざっていれば、そのまま
    const mixed = {
      R1: side("negative"),
      R2: side("negative"),
      R3: side("undecided"),
    };
    expect(enforceMix(mixed, keys, "negative")).toEqual(mixed);
    // 軸が1つなら混ぜられない
    expect(enforceMix({ R1: side("negative") }, ["R1"], "negative")).toEqual({
      R1: side("negative"),
    });
  });

  it("keeps the AI's experiences and fills missing judgments with the lean", () => {
    const cast = normalizeCast(
      {
        member1: {
          experiences: [
            { episode: "親の通院の送り迎えで苦労した", emotion: "心細さ" },
            { episode: "" },
            { episode: "2つ目" },
            { episode: "3つ目は捨てる" },
          ],
          judgments: {
            R1: { side: "affirmative", because: "置き去りにしたくない" },
            R2: { side: "maybe" },
            R9: { side: "negative" },
          },
        },
      },
      [{ key: "R1" }, { key: "R2" }]
    );
    expect(cast.member1.experiences).toHaveLength(2);
    expect(cast.member1.judgments).toEqual({
      R1: { side: "affirmative", because: "置き去りにしたくない" },
      R2: { side: "undecided", because: "" },
    });
    expect(cast.member2.experiences).toEqual([]);
    expect(Object.values(cast.member2.judgments).map((j) => j.side)).toEqual([
      "negative",
      "undecided",
    ]);
  });
});

describe("applyJudgment", () => {
  const make = () => ({
    step: 6,
    judgments: { member2: { R1: "negative", R2: "affirmative" } },
    judgmentLog: [],
  });

  it("changes only the speaker's judgment, with a reason, and records it", () => {
    const session = make();
    const entry = applyJudgment(session, "member2", {
      axis: "R1",
      to: "undecided",
      because: "使っている人が多いと聞いたので",
    });
    expect(entry).toMatchObject({ from: "negative", to: "undecided" });
    expect(session.judgments.member2.R1).toBe("undecided");
    expect(session.judgmentLog).toHaveLength(1);
  });

  it("ignores a change without a reason, to an unknown axis, or of another member", () => {
    const session = make();
    const apply = (speaker, judgment) =>
      applyJudgment(session, speaker, judgment);
    expect(
      apply("member2", { axis: "R1", to: "undecided", because: "" })
    ).toBeNull();
    expect(
      apply("member2", { axis: "R9", to: "undecided", because: "x" })
    ).toBeNull();
    expect(
      apply("member2", { axis: "R1", to: "maybe", because: "x" })
    ).toBeNull();
    expect(
      apply("member2", { axis: "R1", to: "negative", because: "x" })
    ).toBeNull();
    expect(
      apply("member1", { axis: "R1", to: "undecided", because: "x" })
    ).toBeNull();
    expect(apply("facilitator", null)).toBeNull();
    expect(session.judgments.member2.R1).toBe("negative");
    expect(session.judgmentLog).toHaveLength(0);
  });

  it("passes the judgment through normalizeTurn and applyTurn", () => {
    const session = { ...make(), messages: [], outputs: {} };
    const turn = normalizeTurn(
      {
        speaker: "member2",
        content: "その話を聞いて、少し考えが変わりました。",
        judgment: { axis: "R2", to: "undecided", because: "費用の話を聞いた" },
      },
      6
    );
    applyTurn(session, turn);
    expect(session.judgments.member2.R2).toBe("undecided");
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
