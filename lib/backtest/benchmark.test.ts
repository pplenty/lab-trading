import {describe, expect, it} from "vitest";
import {BENCHMARK_SYMBOL, benchmarkReturnOverRange} from "./benchmark";
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

describe("BENCHMARK_SYMBOL", () => {
  it("자산군별 시장 프록시", () => {
    expect(BENCHMARK_SYMBOL.crypto).toBe("btc");
    expect(BENCHMARK_SYMBOL.us).toBe("spy");
    expect(BENCHMARK_SYMBOL.kr).toBe("069500");
  });
});
