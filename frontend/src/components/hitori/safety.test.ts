import { describe, expect, it } from "vitest";
import { detectSafety } from "./safety";

describe("detectSafety", () => {
  it.each([
    "もう死にたいです",
    "しにたいと思うことがある",
    "親に叩かれています",
  ])("本人の危険の打ち明けは urgent（%s）", (text) =>
    expect(detectSafety(text)).toBe("urgent")
  );
  it.each(["暴力のない地域にしたい", "いじめの問題を考えたい"])(
    "話題として出る言葉は watch（%s）",
    (text) => expect(detectSafety(text)).toBe("watch")
  );
  it("関係のない発言には反応しない", () => {
    expect(detectSafety("学童に空きがありませんでした")).toBeNull();
  });
});
