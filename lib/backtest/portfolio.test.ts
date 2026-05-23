import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {runPortfolioBacktest, type PortfolioPosition} from "./portfolio";

const DAY = 86400;

function mkCandles(closes: number[], startT: number): Candle[] {
  return closes.map((c, i) => ({
    t: startT + i * DAY,
    o: c,
    h: c,
    l: c,
    c,
    v: 1,
  }));
}

// 2024-01-01 UTC 기준 startT 계산
const T_2024_01_01 = Math.floor(Date.UTC(2024, 0, 1) / 1000);

describe("runPortfolioBacktest — rebalance modes", () => {
  // 단순 시나리오: 자산 A 100 → 200 (×2 상승), 자산 B 100 → 50 (½ 하락)
  // 50/50 weight, 100일 일봉
  // none: 시작 5,000 each → A 끝 10,000 / B 끝 2,500 → total 12,500 (+25%)
  // 자산 둘이 합쳐서 양수, 음수가 cancel 한 결과
  it("none mode reproduces Buy & Hold weight allocation", () => {
    const aCloses = Array.from({length: 100}, (_, i) => 100 + i); // 100→199
    const bCloses = Array.from({length: 100}, (_, i) => 100 - i * 0.5); // 100→50.5
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(aCloses, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(bCloses, T_2024_01_01)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "none",
      feePct: 0,
      slippagePct: 0,
    });
    expect(result.rebalanceCount).toBe(0);
    expect(result.rebalanceCost).toBe(0);
    expect(result.equityCurve.length).toBe(100);
    // 첫 시점 mark = 10000 (전액 투자)
    expect(result.equityCurve[0].v).toBeCloseTo(10000, 0);
    // 자산 A units = 50 (5000 / 100), 자산 B units = 50 (5000 / 100)
    // 끝 시점: 50 × 199 + 50 × 50.5 = 9950 + 2525 = 12475
    expect(result.equityCurve[99].v).toBeCloseTo(12475, 0);
  });

  it("monthly rebalance: boundary 마다 weight 회복", () => {
    // 100일 ≈ 3-4 month boundary
    const aCloses = Array.from({length: 100}, (_, i) => 100 + i);
    const bCloses = Array.from({length: 100}, (_, i) => 100 - i * 0.5);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(aCloses, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(bCloses, T_2024_01_01)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "monthly",
      feePct: 0,
      slippagePct: 0,
    });
    // 100일 ≈ 3개 월 경계 (Feb 1, Mar 1, Apr 1, ...)
    expect(result.rebalanceCount).toBeGreaterThanOrEqual(2);
    expect(result.rebalanceCount).toBeLessThanOrEqual(4);
    // rebalance 가 weight 복원 → 비대칭 누적 효과 다름 (none 대비)
    expect(result.equityCurve[99].v).not.toBeCloseTo(12475, 1);
  });

  it("yearly rebalance: 365일 미만이면 rebalance 0회", () => {
    const closes = Array.from({length: 100}, (_, i) => 100 + i);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(closes, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(closes, T_2024_01_01)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "yearly",
      feePct: 0,
      slippagePct: 0,
    });
    expect(result.rebalanceCount).toBe(0);
  });

  it("yearly rebalance: 400일 → 1회 boundary", () => {
    const closes = Array.from({length: 400}, (_, i) => 100 + i * 0.1);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(closes, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(closes, T_2024_01_01)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "yearly",
      feePct: 0,
      slippagePct: 0,
    });
    // 2024-01-01 + 400 days = 2025-02-04 → 2025-01-01 boundary 1회
    expect(result.rebalanceCount).toBe(1);
  });

  it("rebalance fee 가 누적 cost 로 반영", () => {
    const aCloses = Array.from({length: 200}, (_, i) => 100 + i);
    const bCloses = Array.from({length: 200}, (_, i) => 100 - i * 0.2);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(aCloses, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(bCloses, T_2024_01_01)},
    ];
    const noFee = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "monthly",
      feePct: 0,
      slippagePct: 0,
    });
    const withFee = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "monthly",
      feePct: 0.001,
      slippagePct: 0.0005,
    });
    expect(noFee.rebalanceCost).toBe(0);
    expect(withFee.rebalanceCost).toBeGreaterThan(0);
    // fee 적용 시 최종 자산이 더 낮음
    expect(withFee.equityCurve[withFee.equityCurve.length - 1].v).toBeLessThan(
      noFee.equityCurve[noFee.equityCurve.length - 1].v
    );
  });

  it("intersection timestamps — 종목 1 100일 / 종목 2 80일 → 공통 봉만 사용", () => {
    const closes1 = Array.from({length: 100}, (_, i) => 100 + i);
    const closes2 = Array.from({length: 80}, (_, i) => 100 + i * 2);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.5, candles: mkCandles(closes1, T_2024_01_01)},
      // 종목 2 는 20일 늦게 시작 (offset)
      {class: "us", symbol: "b", weight: 0.5, candles: mkCandles(closes2, T_2024_01_01 + 20 * DAY)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "none",
      feePct: 0,
      slippagePct: 0,
    });
    // 공통 봉 = 80일 (종목 1 의 [20, 100) 와 종목 2 의 [0, 80) 가 timestamp 동일)
    expect(result.equityCurve.length).toBe(80);
  });

  it("weight 정규화 — 0.6 + 0.6 = 1.2 → 50/50 으로 자동 normalize", () => {
    const closes = Array.from({length: 50}, (_, i) => 100 + i);
    const positions: PortfolioPosition[] = [
      {class: "us", symbol: "a", weight: 0.6, candles: mkCandles(closes, T_2024_01_01)},
      {class: "us", symbol: "b", weight: 0.6, candles: mkCandles(closes, T_2024_01_01)},
    ];
    const result = runPortfolioBacktest({
      positions,
      initialCapital: 10000,
      rebalance: "none",
      feePct: 0,
      slippagePct: 0,
    });
    // 두 자산 동일 close → 둘 다 같은 returnPct, contributionPct 합 = 100%
    expect(result.perAsset[0].weight).toBeCloseTo(0.5, 5);
    expect(result.perAsset[1].weight).toBeCloseTo(0.5, 5);
  });
});
