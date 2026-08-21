import { describe, expect, it } from "vitest";
import { computeResultRank } from "./resultRank";

describe("computeResultRank", () => {
  it("returns S for a smooth run with no bottom-outs and low impact/average G", () => {
    expect(
      computeResultRank({ maxImpact: 1.0, bottomOutCount: 0, averageAbsVerticalG: 0.1 })
    ).toBe("S");
  });

  it("returns A when metrics are good but miss the S thresholds", () => {
    expect(
      computeResultRank({ maxImpact: 3.0, bottomOutCount: 0, averageAbsVerticalG: 0.4 })
    ).toBe("A");
  });

  it("falls back to B once a bottom-out occurs even with otherwise good metrics", () => {
    expect(
      computeResultRank({ maxImpact: 1.0, bottomOutCount: 1, averageAbsVerticalG: 0.1 })
    ).toBe("B");
  });

  it("returns B when maxImpact exceeds the A threshold but stays under the B ceiling", () => {
    expect(
      computeResultRank({ maxImpact: 4.5, bottomOutCount: 0, averageAbsVerticalG: 0.1 })
    ).toBe("B");
  });

  it("returns C once bottom-outs exceed the B allowance", () => {
    expect(
      computeResultRank({ maxImpact: 1.0, bottomOutCount: 3, averageAbsVerticalG: 0.1 })
    ).toBe("C");
  });

  it("returns C for a harsh run with high maxImpact regardless of other stats", () => {
    expect(
      computeResultRank({ maxImpact: 6.0, bottomOutCount: 0, averageAbsVerticalG: 0.1 })
    ).toBe("C");
  });
});
