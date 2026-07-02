import {describe, expect, it} from "vitest";
import {
  analyzeCostSensitivity,
  COST_MULTIPLES,
  type CostPoint,
} from "./cost-sensitivity";
import {runBacktest} from "./run";
import type {Candle} from "@/lib/types";

const DAY = 86400;

function mkCandles(prices: number[]): Candle[] {
  return prices.map((p, i) => ({t: i * DAY, o: p, h: p, l: p, c: p, v: 1}));
}

/** [multiple, pct] 쌍으로 CostPoint[] 생성 (fills 4 고정). */
function pts(pairs: Array<[number, number]>): CostPoint[] {
  return pairs.map(([multiple, pct]) => ({multiple, pct, fills: 4}));
}

describe("analyzeCostSensitivity — verdict", () => {
  it("최대 배율에서도 우위 양수 → robust, breakEven null", () => {
    const r = analyzeCostSensitivity(
      pts([[0, 30], [0.5, 28], [1, 26], [1.5, 24], [2, 22], [3, 18]]),
      10
    )!;
    expect(r.verdict).toBe("robust");
    expect(r.breakEvenMultiple).toBeNull();
    expect(r.edgeAt1xPp).toBeCloseTo(16, 6);
    expect(r.edgeAt0xPp).toBeCloseTo(20, 6);
    expect(r.costDragPp).toBeCloseTo(4, 6);
    expect(r.fills).toBe(4);
  });

  it("손익분기 1×~2× → thin + 선형보간 배율", () => {
    // buyHold 10: edge 1×=+4, 1.5×=0 → 정확히 1.5 에서 소멸.
    const r = analyzeCostSensitivity(
      pts([[0, 20], [0.5, 18], [1, 14], [1.5, 10], [2, 6], [3, 2]]),
      10
    )!;
    expect(r.verdict).toBe("thin");
    expect(r.breakEvenMultiple).toBeCloseTo(1.5, 6);
  });

  it("손익분기 ≥ 2× → moderate", () => {
    // edge 2×=+2, 3×=-2 → 보간 2.5.
    const r = analyzeCostSensitivity(
      pts([[0, 6], [0.5, 5], [1, 4], [1.5, 3], [2, 2], [3, -2]]),
      0
    )!;
    expect(r.verdict).toBe("moderate");
    expect(r.breakEvenMultiple).toBeCloseTo(2.5, 6);
  });

  it("무비용 우위인데 현재 비용이 지움 → cost-eaten (분기 <1×)", () => {
    // edge 0×=+3, 0.5×=+1, 1×=-1 → 보간 0.75.
    const r = analyzeCostSensitivity(
      pts([[0, 3], [0.5, 1], [1, -1], [1.5, -3], [2, -5], [3, -9]]),
      0
    )!;
    expect(r.verdict).toBe("cost-eaten");
    expect(r.breakEvenMultiple).toBeCloseTo(0.75, 6);
    expect(r.edgeAt0xPp).toBeCloseTo(3, 6);
    expect(r.edgeAt1xPp).toBeCloseTo(-1, 6);
  });

  it("±0.01%p 중립대 — 초미세 양수 우위는 no-edge (ResultCard neutral 과 정합)", () => {
    const r = analyzeCostSensitivity(
      pts([[0, 0.009], [0.5, 0.007], [1, 0.005], [1.5, 0.003], [2, 0.001], [3, -0.003]]),
      0
    )!;
    expect(r.verdict).toBe("no-edge"); // e1=0.005 ≤ 0.01 · e0=0.009 ≤ 0.01
  });

  it("비용과 무관하게 우위 없음 → no-edge, breakEven null", () => {
    const r = analyzeCostSensitivity(
      pts([[0, 5], [0.5, 4], [1, 3], [1.5, 2], [2, 1], [3, -1]]),
      10 // buyHold 가 항상 위
    )!;
    expect(r.verdict).toBe("no-edge");
    expect(r.breakEvenMultiple).toBeNull();
  });

  it("edge 동률(0 낙차) 크로싱 float 방어 — 우측 배율 반환", () => {
    // edge 1×=+0, 아니 ePrev>0 필요: 0.5×=+2, 1×=+2(동률), 1.5×=0 →
    // 크로싱 쌍 (1, 1.5): ePrev 2, eCur 0 → denom 2 → 정상 보간 1.5.
    // 완전 동률 쌍 (ePrev>0, eCur=ePrev) 은 크로싱 아님 — 스킵됨을 확인.
    const r = analyzeCostSensitivity(
      pts([[0, 2], [0.5, 2], [1, 2], [1.5, 0], [2, -2], [3, -4]]),
      0
    )!;
    expect(r.breakEvenMultiple).toBeCloseTo(1.5, 6);
    expect(r.verdict).toBe("thin");
  });
});

describe("analyzeCostSensitivity — 분석 불능", () => {
  it("0× 또는 1× 격자 누락 / 점 부족 → null", () => {
    expect(analyzeCostSensitivity(pts([[0, 10]]), 0)).toBeNull();
    expect(
      analyzeCostSensitivity(pts([[0.5, 10], [1, 8], [2, 6]]), 0)
    ).toBeNull(); // 0× 누락
    expect(
      analyzeCostSensitivity(pts([[0, 10], [0.5, 8], [2, 6]]), 0)
    ).toBeNull(); // 1× 누락
  });

  it("입력 순서 무관 — 내부 정렬", () => {
    const r = analyzeCostSensitivity(
      pts([[3, 18], [0, 30], [1, 26], [0.5, 28], [2, 22], [1.5, 24]]),
      10
    )!;
    expect(r.points.map((p) => p.multiple)).toEqual([0, 0.5, 1, 1.5, 2, 3]);
    expect(r.verdict).toBe("robust");
  });
});

describe("엔진 속성 — 비용 배율과 신호 독립성", () => {
  it("배율만 바꾸면 거래 수 동일 + 성과 단조 감소 (sma-cross)", () => {
    // 하락→상승(골든크로스 buy)→하락(데드크로스 sell)→상승 — 최소 1 round-trip.
    const series = [
      100, 98, 96, 94, 92, 95, 100, 106, 112, 118, 124, 120, 112, 104, 96, 90,
      92, 96, 102, 110,
    ];
    const candles = mkCandles(series);
    const run = (m: number) => {
      const r = runBacktest({
        symbol: "crypto:test",
        class: "crypto",
        candles,
        strategyId: "sma-cross",
        params: {fast: 2, slow: 4},
        initialCapital: 10000,
        feePct: 0.001 * m,
        slippagePct: 0.0005 * m,
        fillModel: "next-open",
      });
      return {pct: r.metrics.totalReturnPct, fills: r.trades.length};
    };
    const results = COST_MULTIPLES.map((m) => run(m));
    const fills = results.map((r) => r.fills);
    expect(fills[0]).toBeGreaterThanOrEqual(2); // 매수+매도 체결 발생
    expect(new Set(fills).size).toBe(1); // 신호는 비용과 무관
    for (let i = 1; i < results.length; i++) {
      expect(results[i].pct).toBeLessThan(results[i - 1].pct);
    }
  });

  it("buy-and-hold — round-trip 0 이어도 체결 1회라 비용이 성과에 영향", () => {
    const candles = mkCandles([100, 100, 100, 200]);
    const run = (m: number) => {
      const r = runBacktest({
        symbol: "crypto:test",
        class: "crypto",
        candles,
        strategyId: "buy-and-hold",
        params: {},
        initialCapital: 10000,
        feePct: 0.001 * m,
        slippagePct: 0.0005 * m,
        fillModel: "next-open",
      });
      return {
        pct: r.metrics.totalReturnPct,
        fills: r.trades.length,
        roundTrips: r.metrics.tradeCount,
      };
    };
    const free = run(0);
    const paid = run(1);
    expect(free.roundTrips).toBe(0); // 매도 없음 — round-trip 기준으론 0
    expect(free.fills).toBe(1); // 하지만 진입 체결 1회
    expect(paid.pct).toBeLessThan(free.pct); // 비용이 실제로 성과를 깎음
  });
});
