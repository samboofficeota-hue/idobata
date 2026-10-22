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

// AIの代わり。骨組みは決まった2軸、仕分けは声の文で側を決める
const llm = vi.hoisted(() => ({ calls: [], fail: false }));
vi.mock("../services/llmService.js", () => ({
  callLLM: async (messages) => {
    const system = messages[0].content;
    llm.calls.push(system);
    if (llm.fail) throw new Error("upstream down");
    if (system.includes("合意と対立の軸」を最大")) {
      return {
        axes: [
          {
            proposition: "共用自転車を残すべきか",
            agreement: ["通路の安全は守る"],
            affirmative: "高齢者の足として必要",
            negative: "放置と費用の負担が大きい",
            undecidedReason: "利用者の数が分からない",
            sources: ["Q1", "Q9"],
          },
          { proposition: "肯定側も否定側もない軸" },
        ],
      };
    }
    const refs = [...messages[1].content.matchAll(/- (V\d+)（[^）]+）：(.+)/g)];
    return {
      assignments: refs.map(([, ref, text]) => ({
        ref,
        axis: text.includes("関係ない") ? "" : "A1",
        side: text.includes("登録制")
          ? "affirmative"
          : text.includes("費用")
            ? "negative"
            : "undecided",
      })),
    };
  },
}));

const {
  computeFingerprint,
  normalizeAssignments,
  normalizeSkeleton,
  runThemeAxes,
} = await import("../services/themeAxes/builder.js");
const { default: Theme } = await import("../models/Theme.js");
const { default: SharpQuestion } = await import("../models/SharpQuestion.js");
const { default: DebateAnalysis } = await import("../models/DebateAnalysis.js");
const { default: Problem } = await import("../models/Problem.js");
const { default: Solution } = await import("../models/Solution.js");
const { default: ThemeAxes } = await import("../models/ThemeAxes.js");

describe("normalizeSkeleton", () => {
  const analyses = [{ question: { _id: "q1" }, analysis: { version: 1 } }];

  it("keeps only two-sided axes, at most three, with known sources", () => {
    const axes = normalizeSkeleton(
      {
        axes: [
          {
            proposition: "残すべきか",
            affirmative: "必要",
            negative: "負担",
            agreement: ["安全", "", "a", "b"],
            sources: ["Q1", "Q2", "Q1"],
          },
          { proposition: "片側だけ", affirmative: "必要" },
          { proposition: "2", affirmative: "x", negative: "y" },
          { proposition: "3", affirmative: "x", negative: "y" },
          { proposition: "4", affirmative: "x", negative: "y" },
        ],
      },
      analyses
    );
    expect(axes.map((a) => a.key)).toEqual(["A1", "A2", "A3"]);
    expect(axes[0]).toMatchObject({
      proposition: "残すべきか",
      agreement: ["安全", "a", "b"],
      sourceQuestionIds: ["q1"],
    });
    expect(normalizeSkeleton({ axes: [] }, analyses)).toEqual([]);
  });

  it("drops assignments to unknown voices, axes and sides", () => {
    const voices = [
      { _id: "p1", itemType: "problem" },
      { _id: "s1", itemType: "solution" },
    ];
    expect(
      normalizeAssignments(
        {
          assignments: [
            { ref: "V1", axis: "A1", side: "negative" },
            { ref: "V1", axis: "A1", side: "affirmative" },
            { ref: "V2", axis: "A9", side: "negative" },
            { ref: "V3", axis: "A1", side: "negative" },
            { ref: "V2", axis: "A1", side: "maybe" },
          ],
        },
        [{ key: "A1" }],
        voices
      )
    ).toEqual([
      { axis: "A1", itemType: "problem", itemId: "p1", side: "negative" },
    ]);
  });

  it("changes the fingerprint when an analysis or enough voices are added", () => {
    const a = [{ question: { _id: "q1" }, analysis: { version: 1 } }];
    const b = [{ question: { _id: "q1" }, analysis: { version: 2 } }];
    expect(computeFingerprint(a, 5)).toBe(computeFingerprint(a, 19));
    expect(computeFingerprint(a, 5)).not.toBe(computeFingerprint(a, 20));
    expect(computeFingerprint(a, 5)).not.toBe(computeFingerprint(b, 5));
  });
});

// ローカルや CI に MongoDB がなければ、このテストは飛ばす
const MONGO_URI =
  process.env.KAIGI_TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27017/theme_axes_test";
const mongoAvailable = await mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 1500 })
  .then(() => true)
  .catch(() => false);

describe.skipIf(!mongoAvailable)("runThemeAxes", () => {
  let theme;
  let question;

  beforeAll(async () => {
    await mongoose.connection.dropDatabase();
    await ThemeAxes.syncIndexes();
    theme = await Theme.create({ title: "共用自転車", slug: "bike" });
    question = await SharpQuestion.create({
      questionText: "共用自転車をどうするか",
      themeId: theme._id,
    });
    await DebateAnalysis.create({
      questionId: question._id,
      questionText: question.questionText,
      axes: [
        {
          title: "存続",
          options: [{ label: "残す" }, { label: "やめる" }],
        },
      ],
      agreementPoints: ["通路の安全"],
      disagreementPoints: ["費用"],
      version: 1,
    });
    const source = {
      sourceOriginId: new mongoose.Types.ObjectId(),
      sourceType: "chat",
      themeId: theme._id,
    };
    await Problem.create({ ...source, statement: "費用が管理費を圧迫する" });
    await Problem.create({ ...source, statement: "関係ない話" });
    await Solution.create({ ...source, statement: "登録制にする" });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    llm.calls = [];
    llm.fail = false;
  });

  it("builds the axes from the analyses and ties the original voices to each side", async () => {
    const before = await DebateAnalysis.find().lean();
    const result = await runThemeAxes({ themeId: theme._id });
    expect(result[theme._id]).toMatchObject({ version: 1, axes: 1, voices: 2 });

    const saved = await ThemeAxes.findOne({ themeId: theme._id }).lean();
    expect(saved.axes).toHaveLength(1);
    expect(saved.axes[0]).toMatchObject({
      key: "A1",
      proposition: "共用自転車を残すべきか",
      agreement: ["通路の安全は守る"],
    });
    expect(saved.axes[0].sourceQuestionIds.map(String)).toEqual([
      String(question._id),
    ]);
    expect(saved.axes[0].voices.map((v) => v.side).sort()).toEqual([
      "affirmative",
      "negative",
    ]);
    // 本体のデータは変わらない
    expect(await DebateAnalysis.find().lean()).toEqual(before);
  });

  it("does nothing when the analyses and voices have not changed", async () => {
    expect((await runThemeAxes({ themeId: theme._id }))[theme._id]).toEqual({
      skipped: "unchanged",
      version: 1,
    });
    expect(llm.calls).toHaveLength(0);
  });

  it("builds a new version when an analysis is updated, keeping a few old ones", async () => {
    for (const version of [2, 3, 4]) {
      await DebateAnalysis.create({
        questionId: question._id,
        questionText: question.questionText,
        version,
      });
      await runThemeAxes({ themeId: theme._id });
    }
    const versions = (
      await ThemeAxes.find({ themeId: theme._id }).sort({ version: 1 }).lean()
    ).map((a) => a.version);
    expect(versions).toEqual([2, 3, 4]);
  });

  it("reports a failure without stopping", async () => {
    llm.fail = true;
    const result = await runThemeAxes({ themeId: theme._id, force: true });
    expect(result[theme._id].failed).toBe("upstream down");
  });
});
