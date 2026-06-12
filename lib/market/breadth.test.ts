import {describe, expect, it} from "vitest";
import {computeMarketBreadth} from "./breadth";
import type {Quote} from "@/lib/types";

const q = (symbol: string, changePct24h: number): Quote => ({
  symbol,
  class: "crypto",
  price: 100,
  currency: "KRW",
  changePct24h,
  updatedAt: "2026-06-13T00:00:00Z",
  source: "test",
});

describe("computeMarketBreadth", () => {
  it("상승/하락/보합 카운트 + 평균 + 비율", () => {
    const b = computeMarketBreadth([
      q("a", 5),
      q("b", -2),
      q("c", 0),
      q("d", 3),
    ])!;
    expect(b.total).toBe(4);
    expect(b.up).toBe(2);
    expect(b.down).toBe(1);
    expect(b.flat).toBe(1);
    expect(b.avgChangePct).toBeCloseTo((5 - 2 + 0 + 3) / 4, 9);
    expect(b.upRatio).toBeCloseTo(0.5, 9);
  });

  it("최고/최저 변동 종목", () => {
    const b = computeMarketBreadth([
      q("a", 5),
      q("b", -8),
      q("c", 12),
      q("d", -1),
    ])!;
    expect(b.topGainer).toEqual({symbol: "c", changePct: 12});
    expect(b.topLoser).toEqual({symbol: "b", changePct: -8});
  });

  it("전부 하락이면 topGainer 는 가장 덜 떨어진 종목", () => {
    const b = computeMarketBreadth([q("a", -3), q("b", -1), q("c", -7)])!;
    expect(b.up).toBe(0);
    expect(b.down).toBe(3);
    expect(b.topGainer).toEqual({symbol: "b", changePct: -1});
    expect(b.topLoser).toEqual({symbol: "c", changePct: -7});
  });

  it("빈 배열 → null", () => {
    expect(computeMarketBreadth([])).toBeNull();
  });

  it("단일 종목", () => {
    const b = computeMarketBreadth([q("a", 4)])!;
    expect(b.total).toBe(1);
    expect(b.upRatio).toBe(1);
    expect(b.topGainer).toEqual({symbol: "a", changePct: 4});
    expect(b.topLoser).toEqual({symbol: "a", changePct: 4});
  });
});
