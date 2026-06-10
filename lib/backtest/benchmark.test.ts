import {describe, expect, it} from "vitest";
import {
  BENCHMARK_SYMBOL,
  benchmarkMetricsOverRange,
  benchmarkReturnOverRange,
} from "./benchmark";
import {
  cagrPct,
  mddPct,
  returnsFromEquity,
  sharpe,
  totalReturnPct,
} from "./metrics";
import type {Candle} from "@/lib/types";

const c = (t: number, close: number): Candle => ({
  t,
  o: close,
  h: close,
  l: close,
  c: close,
  v: 0,
});

describe("benchmarkReturnOverRange", () => {
  const candles = [c(100, 10), c(200, 11), c(300, 12), c(400, 13.2)];

  it("구간 buy&hold 총수익률 (10 → 13.2 = +32%)", () => {
    expect(benchmarkReturnOverRange(candles, 100, 400)).toBeCloseTo(32, 6);
  });

  it("fromT 이상 첫 봉 / toT 이하 마지막 봉", () => {
    // [150,350]: first≥150=11, last≤350=12 → +9.09%
    expect(benchmarkReturnOverRange(candles, 150, 350)).toBeCloseTo(
      (12 / 11 - 1) * 100,
      6
    );
  });

  it("범위 밖 from/to → 전체 구간", () => {
    expect(benchmarkReturnOverRange(candles, 0, 9999)).toBeCloseTo(32, 6);
  });

  it("< 2 봉 → null", () => {
    expect(benchmarkReturnOverRange([c(100, 10)], 0, 200)).toBeNull();
  });

  it("구간에 유효 봉 1개 이하 → null", () => {
    // first≥350=c(400), last≤360=c(300) → first.t≥last.t → null
    expect(benchmarkReturnOverRange(candles, 350, 360)).toBeNull();
  });
});

describe("benchmarkMetricsOverRange", () => {
  // 86400 = 1일. 5봉, 일 간격 — CAGR dayCount 계산 검증 가능.
  const day = 86400;
  const candles = [
    c(1 * day, 100),
    c(2 * day, 110),
    c(3 * day, 90),
    c(4 * day, 120),
    c(5 * day, 130),
  ];

  it("총수익·CAGR·MDD·Sharpe 를 전략과 동일 metrics 함수로 계산 (apples-to-apples)", () => {
    const closes = [100, 110, 90, 120, 130];
    const m = benchmarkMetricsOverRange(candles, 0, 10 * day)!;
    expect(m).not.toBeNull();
    const dayCount = (5 * day - 1 * day) / 86400; // 4일
    expect(m.totalReturnPct).toBeCloseTo(totalReturnPct(closes), 9);
    expect(m.cagrPct).toBeCloseTo(cagrPct(closes, dayCount), 9);
    expect(m.mddPct).toBeCloseTo(mddPct(closes), 9);
    expect(m.sharpe).toBeCloseTo(sharpe(returnsFromEquity(closes)), 9);
  });

  it("MDD 는 peak(110) 대비 trough(90) = 18.18%", () => {
    const m = benchmarkMetricsOverRange(candles, 0, 10 * day)!;
    expect(m.mddPct).toBeCloseTo(((110 - 90) / 110) * 100, 6);
  });

  it("총수익은 benchmarkReturnOverRange 와 일치", () => {
    const m = benchmarkMetricsOverRange(candles, 0, 10 * day)!;
    expect(m.totalReturnPct).toBeCloseTo(
      benchmarkReturnOverRange(candles, 0, 10 * day)!,
      9
    );
  });

  it("구간 클램프 — [2일,4일] 만 집계", () => {
    const m = benchmarkMetricsOverRange(candles, 2 * day, 4 * day)!;
    // closes [110,90,120] → total (120/110-1)*100
    expect(m.totalReturnPct).toBeCloseTo((120 / 110 - 1) * 100, 6);
  });

  it("구간 유효 봉 < 2 → null", () => {
    // [4.5일, 10일] → c(5일)=130 단 1봉 → <2 → null
    expect(benchmarkMetricsOverRange(candles, 4.5 * day, 10 * day)).toBeNull();
    expect(benchmarkMetricsOverRange([c(day, 100)], 0, 10 * day)).toBeNull();
  });
});

describe("BENCHMARK_SYMBOL", () => {
  it("자산군별 시장 프록시", () => {
    expect(BENCHMARK_SYMBOL.crypto).toBe("btc");
    expect(BENCHMARK_SYMBOL.us).toBe("spy");
    expect(BENCHMARK_SYMBOL.kr).toBe("069500");
  });
});
