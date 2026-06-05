import {describe, expect, it} from "vitest";
import {computeKimchiPremium} from "./kimchi";

describe("computeKimchiPremium — (upbitKRW / (binanceUSD × fx) − 1) × 100", () => {
  it("한국이 비싸면 양수(김프)", () => {
    // implied = 68000 × 1450 = 98,600,000. upbit 100,000,000 → +1.42%
    const p = computeKimchiPremium(100_000_000, 68_000, 1450);
    expect(p).toBeCloseTo((100_000_000 / 98_600_000 - 1) * 100, 6);
    expect(p).toBeGreaterThan(0);
  });

  it("동일하면 0", () => {
    expect(computeKimchiPremium(98_600_000, 68_000, 1450)).toBeCloseTo(0, 6);
  });

  it("한국이 싸면 음수(역프)", () => {
    expect(computeKimchiPremium(97_000_000, 68_000, 1450)).toBeLessThan(0);
  });

  it("정확한 비율", () => {
    // implied 1,450,000 → upbit 1,479,000 = +2%
    expect(computeKimchiPremium(1_479_000, 1000, 1450)).toBeCloseTo(2, 6);
  });

  it("0/음수 implied 가드 → 0", () => {
    expect(computeKimchiPremium(100, 0, 1450)).toBe(0);
    expect(computeKimchiPremium(100, 68_000, 0)).toBe(0);
  });
});
