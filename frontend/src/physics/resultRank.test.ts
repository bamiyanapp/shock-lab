import { describe, expect, it } from "vitest";
import { computeResultRank } from "./resultRank";

describe("computeResultRank", () => {
  it("returns S for a smooth run with no bottom-outs and almost no impact (e.g. flat road)", () => {
    expect(computeResultRank({ maxImpact: 0.07, bottomOutCount: 0, averageAbsVerticalG: 0.014 })).toBe("S");
  });

  it("returns A for a run over small bumps with no bottom-outs", () => {
    expect(computeResultRank({ maxImpact: 0.6, bottomOutCount: 0, averageAbsVerticalG: 0.15 })).toBe("A");
  });

  it("falls back to B once a bottom-out occurs even with otherwise good metrics", () => {
    expect(computeResultRank({ maxImpact: 0.2, bottomOutCount: 1, averageAbsVerticalG: 0.03 })).toBe("B");
  });

  it("returns B when maxImpact exceeds the A threshold but stays under the B ceiling", () => {
    expect(computeResultRank({ maxImpact: 2.5, bottomOutCount: 0, averageAbsVerticalG: 0.1 })).toBe("B");
  });

  it("returns C once bottom-outs exceed the B allowance", () => {
    expect(computeResultRank({ maxImpact: 0.2, bottomOutCount: 3, averageAbsVerticalG: 0.03 })).toBe("C");
  });

  it("returns C for a harsh run with high maxImpact regardless of other stats", () => {
    expect(computeResultRank({ maxImpact: 3.5, bottomOutCount: 0, averageAbsVerticalG: 0.1 })).toBe("C");
  });
});
