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

// AIの代わり。渡された ref ごとに決まったプロフィールを返す
const llm = vi.hoisted(() => ({ calls: [], fail: false }));
vi.mock("../services/llmService.js", () => ({
  callLLM: async (messages) => {
    llm.calls.push(messages);
    if (llm.fail) throw new Error("upstream down");
    const refs = [...messages[1].content.matchAll(/- ([PS]\d+)（/g)].map(
      (m) => m[1]
    );
    return {
      items: refs.map((ref) => ({
        ref,
        stance: "affected",
        evidence: "experience",
        reason: "毎朝、通路をふさがれて通れない",
        values: ["安全", "便利さ"],
        concern: ref.startsWith("S") ? "費用がかかる" : "",
        answers: ref.startsWith("S") ? ["P1"] : [],
      })),
    };
  },
}));

const { hashStatement, needsProfile, normalizeProfiles, runVoiceProfiling } =
  await import("../services/voiceProfile/profiler.js");
const { PROFILE_SCHEMA_VERSION } = await import(
  "../services/voiceProfile/labels.js"
);
const { default: Problem } = await import("../models/Problem.js");
const { default: Solution } = await import("../models/Solution.js");
const { default: ChatThread } = await import("../models/ChatThread.js");
const { default: VoiceProfile } = await import("../models/VoiceProfile.js");

describe("normalizeProfiles", () => {
  const items = [
    { ref: "P1", itemType: "problem", itemId: "p1" },
    { ref: "S1", itemType: "solution", itemId: "s1" },
    { ref: "S2", itemType: "solution", itemId: "s2" },
  ];

  it("keeps values within the fixed choices and lengths", () => {
    const [problem, solution, missing] = normalizeProfiles(
      {
        items: [
          {
            ref: "P1",
            stance: "社長",
            evidence: "experience",
            reason: "あ".repeat(200),
            values: ["安全", "安全", "お金", "費用", "公平", "健康"],
            concern: "問題に懸念はない",
            answers: ["P1"],
          },
          {
            ref: "S1",
            stance: "decider",
            evidence: "opinion",
            values: "安全",
            concern: "費用がかかる",
            answers: ["P1", "P9", "S1", "P1"],
          },
        ],
      },
      items
    );
    expect(problem).toMatchObject({
      stance: "unknown",
      evidence: "experience",
      values: ["安全", "費用", "公平"],
      concern: "",
      answersProblemIds: [],
    });
    expect(problem.reason).toHaveLength(80);
    expect(solution).toMatchObject({
      stance: "decider",
      values: [],
      concern: "費用がかかる",
      answersProblemIds: ["p1"],
    });
    expect(missing).toBeNull();
    expect(normalizeProfiles(null, items)).toEqual([null, null, null]);
  });

  it("asks for a new profile when the statement or the schema changes", () => {
    const item = { statement: "通路がふさがる" };
    const profile = {
      statementHash: hashStatement("通路がふさがる"),
      schemaVersion: PROFILE_SCHEMA_VERSION,
    };
    expect(needsProfile(item, profile)).toBe(false);
    expect(needsProfile(item, null)).toBe(true);
    expect(needsProfile({ statement: "通路が夜にふさがる" }, profile)).toBe(
      true
    );
    expect(needsProfile(item, { ...profile, schemaVersion: 0 })).toBe(true);
  });
});

// ローカルや CI に MongoDB がなければ、このテストは飛ばす
const MONGO_URI =
  process.env.KAIGI_TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/voice_profile_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

describe.skipIf(!mongoAvailable)("runVoiceProfiling", () => {
  const themeId = new mongoose.Types.ObjectId();
  let thread;
  let problem;
  let solution;

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    thread = await ChatThread.create({
      themeId,
      sessionId: "s",
      messages: [
        { role: "user", content: "毎朝、自転車で通路がふさがれて通れません" },
        { role: "assistant", content: "AIの発言は読まない" },
        { role: "user", content: "登録制にしたらどうか。でも費用が心配" },
      ],
    });
    const source = { sourceOriginId: thread._id, sourceType: "chat", themeId };
    problem = await Problem.create({ ...source, statement: "通路がふさがる" });
    solution = await Solution.create({ ...source, statement: "登録制にする" });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    llm.calls = [];
    llm.fail = false;
  });

  it("profiles a source in one call without touching the original data", async () => {
    const before = await Problem.findById(problem._id).lean();
    const summary = await runVoiceProfiling({ themeId });
    expect(summary).toMatchObject({ sources: 1, profiled: 2, failed: 0 });
    expect(llm.calls).toHaveLength(1);

    // 利用者の発言だけを読む
    const prompt = llm.calls[0][1].content;
    expect(prompt).toContain("登録制にしたらどうか");
    expect(prompt).not.toContain("AIの発言は読まない");

    const profile = await VoiceProfile.findOne({ itemId: solution._id }).lean();
    expect(profile).toMatchObject({
      itemType: "solution",
      stance: "affected",
      concern: "費用がかかる",
      schemaVersion: PROFILE_SCHEMA_VERSION,
    });
    expect(profile.answersProblemIds.map(String)).toEqual([
      String(problem._id),
    ]);

    // 本体のデータは1文字も変わらない
    expect(await Problem.findById(problem._id).lean()).toEqual(before);
  });

  it("does nothing when nothing has changed", async () => {
    expect(await runVoiceProfiling({ themeId })).toMatchObject({ sources: 0 });
    expect(llm.calls).toHaveLength(0);
  });

  it("profiles again when the statement is rewritten", async () => {
    // 本体の抽出処理と同じく、文を書き換えて版を上げる
    await Problem.updateOne(
      { _id: problem._id },
      {
        $set: { statement: "朝の通路が自転車でふさがる" },
        $inc: { version: 1 },
      }
    );
    expect(await runVoiceProfiling({ themeId })).toMatchObject({ sources: 1 });
    const profile = await VoiceProfile.findOne({ itemId: problem._id }).lean();
    expect(profile.statementHash).toBe(
      hashStatement("朝の通路が自転車でふさがる")
    );
    expect(profile.itemVersion).toBe(2);
  });

  it("keeps going when the AI fails, and removes profiles of deleted voices", async () => {
    await Problem.updateOne(
      { _id: problem._id },
      { $set: { statement: "また書き換わった" } }
    );
    llm.fail = true;
    expect(await runVoiceProfiling({ themeId })).toMatchObject({
      sources: 0,
      failed: 1,
    });

    await Solution.deleteOne({ _id: solution._id });
    llm.fail = false;
    expect(await runVoiceProfiling({ themeId })).toMatchObject({
      sources: 1,
      removed: 1,
    });
    expect(await VoiceProfile.countDocuments({ itemId: solution._id })).toBe(0);
  });
});
