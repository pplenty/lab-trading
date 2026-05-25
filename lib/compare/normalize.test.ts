import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {
  correlationMatrix,
  normalizeForCompare,
  pearsonCorrelation,
} from "./normalize";

function mkDaily(closes: number[], startT = 0): Candle[] {
  const DAY = 86400;
  return closes.map((c, i) => ({
    t: startT + i * DAY,
    o: c,
    h: c,
    l: c,
    c,
    v: 1,
  }));
}

describe("normalizeForCompare — extended metrics", () => {
  it("일정 상승 series → vol > 0, sharpe > 0, MDD 0", () => {
    const candles = mkDaily(Array.from({length: 30}, (_, i) => 100 + i));
    const [s] = normalizeForCompare([
      {class: "us", symbol: "a", label: "A", candles},
    ]);
    expect(s.totalReturnPct).toBeCloseTo(29, 0); // (129-100)/100 * 100
    expect(s.mddPct).toBe(0);
    expect(s.dailyReturns.length).toBe(29);
    expect(s.volatilityPct).toBeGreaterThan(0);
    expect(s.sharpe).toBeGreaterThan(0);
    expect(s.drawdownPoints.length).toBe(30);
  });

  it("V 모양 — peak 후 하락 → MDD > 0", () => {
    const candles = mkDaily([100, 110, 120, 100, 80]);
    const [s] = normalizeForCompare([
      {class: "us", symbol: "v", label: "V", candles},
    ]);
    // 120 peak → 80 → mdd = (80 - 120) / 120 * 100 ≈ -33.33
    expect(s.mddPct).toBeCloseTo(33.33, 1);
    // 마지막 drawdown point = (-33.33)
    expect(s.drawdownPoints[s.drawdownPoints.length - 1].v).toBeCloseTo(-33.33, 1);
  });

  it("flat series — vol 0, sharpe null", () => {
    const candles = mkDaily([100, 100, 100, 100, 100]);
    const [s] = normalizeForCompare([
      {class: "us", symbol: "f", label: "F", candles},
    ]);
    expect(s.volatilityPct).toBeCloseTo(0, 5);
    expect(s.sharpe).toBeNull();
  });
});

describe("pearsonCorrelation", () => {
  it("동일 시리즈 → 1", () => {
    const a = [0.01, -0.02, 0.005, 0.015, -0.01];
    expect(pearsonCorrelation(a, a)).toBeCloseTo(1, 5);
  });

  it("정반대 시리즈 → -1", () => {
    const a = [0.01, -0.02, 0.005, 0.015, -0.01];
    const b = a.map((v) => -v);
    expect(pearsonCorrelation(a, b)).toBeCloseTo(-1, 5);
  });

  it("길이 다른 시리즈 → tail intersection", () => {
    const a = [0.01, -0.02, 0.005, 0.015, -0.01];
    const b = [0.005, 0.015, -0.01]; // a 의 마지막 3개
    // 같은 끝점 — corr 1
    expect(pearsonCorrelation(a, b)).toBeCloseTo(1, 5);
  });

  it("n < 2 → null", () => {
    expect(pearsonCorrelation([1], [1])).toBeNull();
    expect(pearsonCorrelation([], [])).toBeNull();
  });
});

describe("correlationMatrix", () => {
  it("3 종목 — 대각 1, 대칭, oscillate anti → -1", () => {
    // oscillating series 로 anti-correlation 확실히 만들기
    const a = Array.from({length: 20}, (_, i) => (i % 2 === 0 ? 100 : 110));
    const b = Array.from({length: 20}, (_, i) => (i % 2 === 0 ? 100 : 90));
    const cMonotonic = Array.from({length: 20}, (_, i) => 100 + i);
    const series = normalizeForCompare([
      {class: "us", symbol: "a", label: "A", candles: mkDaily(a)},
      {class: "us", symbol: "b", label: "B", candles: mkDaily(b)},
      {class: "us", symbol: "c", label: "C", candles: mkDaily(cMonotonic)},
    ]);
    const m = correlationMatrix(series);
    expect(m[0][0]).toBe(1);
    expect(m[1][1]).toBe(1);
    expect(m[2][2]).toBe(1);
    expect(m[0][1]).toBe(m[1][0]); // 대칭
    expect(m[0][1]).toBeLessThan(0); // a vs b — anti
    expect(m[0][1]).toBeCloseTo(-1, 1);
  });
});
