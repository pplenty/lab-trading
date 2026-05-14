import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {runBacktest} from "./run";
import type {BacktestConfig} from "./types";

const DAY = 86400;

function mkCandles(prices: number[], startT: number = 0): Candle[] {
  return prices.map((p, i) => ({
    t: startT + i * DAY,
    o: p,
    h: p,
    l: p,
    c: p,
    v: 1,
  }));
}

function baseConfig(candles: Candle[], strategyId: string, params: Record<string, number>): BacktestConfig {
  return {
    symbol: "crypto:test",
    class: "crypto",
    candles,
    strategyId,
    params,
    initialCapital: 10000,
    feePct: 0,
    slippagePct: 0,
    fillModel: "next-open",
  };
}

describe("runBacktest — buy-and-hold", () => {
  it("price 100 → 200 with no fees → totalReturn ≈ +100% (next-open fills at next bar's open)", () => {
    // [100, 100, 100, 200] — buy-and-hold 는 봉0 에서 buy 신호 → 봉1 시가(100) 에 체결.
    // 마지막 봉 종가 200 → equity = (10000/100) × 200 = 20000.
    const candles = mkCandles([100, 100, 100, 200]);
    const result = runBacktest(baseConfig(candles, "buy-and-hold", {}));
    expect(result.metrics.totalReturnPct).toBeCloseTo(100, 4);
    expect(result.metrics.mddPct).toBeCloseTo(0, 4);
  });

  it("with 0.1% fee + 0.05% slippage: totalReturn slightly less than no-cost", () => {
    const candles = mkCandles([100, 100, 200]);
    const noCost = runBacktest(baseConfig(candles, "buy-and-hold", {}));
    const withCost: BacktestConfig = {
      ...baseConfig(candles, "buy-and-hold", {}),
      feePct: 0.001,
      slippagePct: 0.0005,
    };
    const withCostResult = runBacktest(withCost);
    expect(withCostResult.metrics.totalReturnPct).toBeLessThan(
      noCost.metrics.totalReturnPct
    );
    expect(withCostResult.metrics.totalReturnPct).toBeGreaterThan(99);
  });

  it("buyHoldCurve uses first open + last close", () => {
    const candles = mkCandles([100, 100, 100, 200]);
    const result = runBacktest(baseConfig(candles, "buy-and-hold", {}));
    expect(result.buyHoldCurve[0].v).toBeCloseTo(10000, 4); // 100 units × 100
    expect(result.buyHoldCurve[3].v).toBeCloseTo(20000, 4); // 100 units × 200
  });

  it("deterministic — two runs produce identical results", () => {
    const candles = mkCandles([100, 105, 102, 110, 108, 115]);
    const a = runBacktest(baseConfig(candles, "buy-and-hold", {}));
    const b = runBacktest(baseConfig(candles, "buy-and-hold", {}));
    expect(a.metrics).toEqual(b.metrics);
    expect(a.trades).toEqual(b.trades);
    expect(a.equityCurve).toEqual(b.equityCurve);
  });
});

describe("runBacktest — sma-cross", () => {
  it("buy → sell round-trip on a hill-shaped price series", () => {
    // 하락 → 상승(buy) → 하락(sell)
    const series = [
      20, 19, 18, 17, 16, 18, 20, 22, 24, 26, 28, 26, 24, 22, 20, 18, 16, 14,
    ];
    const candles = mkCandles(series);
    const result = runBacktest(
      baseConfig(candles, "sma-cross", {fast: 3, slow: 5})
    );
    const buys = result.trades.filter((t) => t.side === "buy");
    const sells = result.trades.filter((t) => t.side === "sell");
    expect(buys.length).toBeGreaterThanOrEqual(1);
    expect(sells.length).toBeGreaterThanOrEqual(1);
    expect(result.metrics.tradeCount).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid params (fast >= slow)", () => {
    const candles = mkCandles([1, 2, 3, 4, 5]);
    expect(() =>
      runBacktest(baseConfig(candles, "sma-cross", {fast: 50, slow: 20}))
    ).toThrow(/invalid params/);
  });
});

describe("runBacktest — edge cases", () => {
  it("empty candles → zero metrics", () => {
    const result = runBacktest(baseConfig([], "buy-and-hold", {}));
    expect(result.metrics.totalReturnPct).toBe(0);
    expect(result.trades).toEqual([]);
  });

  it("unknown strategy throws", () => {
    const candles = mkCandles([100, 101]);
    expect(() =>
      runBacktest(baseConfig(candles, "no-such-strategy", {}))
    ).toThrow(/unknown strategy/);
  });

  it("date range filter trims candles", () => {
    const candles = mkCandles([100, 110, 120, 130, 140], 0);
    const result = runBacktest({
      ...baseConfig(candles, "buy-and-hold", {}),
      startDate: 1 * DAY,
      endDate: 4 * DAY,
    });
    expect(result.equityCurve.length).toBe(3); // t=1,2,3 (endDate exclusive)
  });

  it("indicators length mismatch throws", () => {
    const candles = mkCandles([100, 101, 102]);
    expect(() =>
      runBacktest({
        ...baseConfig(candles, "buy-and-hold", {}),
        indicators: [{t: 0, computed_version: 1}], // 길이 1 vs candles 3
      })
    ).toThrow(/length/);
  });

  it("same-close fill executes within current bar (lookahead)", () => {
    const candles = mkCandles([100, 100, 100, 200]);
    const result = runBacktest({
      ...baseConfig(candles, "buy-and-hold", {}),
      fillModel: "same-close",
    });
    // 봉 0 종가 100 매수 — totalReturn (200/100 - 1) = 100% (수수료 0).
    expect(result.metrics.totalReturnPct).toBeCloseTo(100, 4);
    // 첫 trade 가 봉 0 t=0 에 체결 (next-open 은 봉 1 t=DAY)
    expect(result.trades[0].t).toBe(0);
  });
});
