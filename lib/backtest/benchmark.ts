import type {AssetClass, Candle} from "@/lib/types";
import {
  cagrPct,
  mddPct,
  returnsFromEquity,
  sharpe,
  totalReturnPct,
} from "./metrics";

// 백테스트 "전략 vs 시장" 벤치마크 — 같은 자산군의 시장 대표 종목(같은 거래 캘린더라 정렬 안전).
//   코인 → BTC(시장 leader) · 미국 → SPY(S&P 500 ETF) · 국내 → KODEX 200(KOSPI 200 ETF).
// 가격(buy&hold) 기준 — 수수료 미반영(시장 참조용).

export const BENCHMARK_SYMBOL: Record<AssetClass, string> = {
  crypto: "btc",
  us: "spy",
  kr: "069500",
};

export const BENCHMARK_LABEL: Record<AssetClass, string> = {
  crypto: "비트코인",
  us: "S&P 500",
  kr: "KOSPI 200",
};

/**
 * 벤치마크 candles 의 [fromT, toT] 구간 buy&hold 총수익률(%). t 오름차순 가정.
 * fromT 이상 첫 봉 종가 → toT 이하 마지막 봉 종가. 데이터 부족/구간 불일치 시 null.
 */
export function benchmarkReturnOverRange(
  candles: Candle[],
  fromT: number,
  toT: number
): number | null {
  if (candles.length < 2) return null;
  const first = candles.find((c) => c.t >= fromT);
  let last: Candle | undefined;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].t <= toT) {
      last = candles[i];
      break;
    }
  }
  if (!first || !last || first.t >= last.t || first.c <= 0) return null;
  return (last.c / first.c - 1) * 100;
}

export type BenchmarkMetrics = {
  totalReturnPct: number;
  cagrPct: number;
  mddPct: number;
  sharpe: number;
};

/**
 * 벤치마크 buy&hold 의 [fromT, toT] 구간 위험조정 지표 — 종가 시리즈를 equity 로
 * 보고 전략과 동일한 metrics 함수(totalReturn/CAGR/MDD/Sharpe)로 계산(apples-to-apples).
 * 전략은 현금 보유 구간이 있을 수 있으나 벤치마크는 상시 투자(buy&hold) 가정.
 * 구간 종가 2개 미만이면 null.
 */
export function benchmarkMetricsOverRange(
  candles: Candle[],
  fromT: number,
  toT: number
): BenchmarkMetrics | null {
  if (candles.length < 2) return null;
  const closes: number[] = [];
  let firstT = 0;
  let lastT = 0;
  for (const c of candles) {
    if (c.t >= fromT && c.t <= toT && c.c > 0) {
      if (closes.length === 0) firstT = c.t;
      lastT = c.t;
      closes.push(c.c);
    }
  }
  if (closes.length < 2 || firstT >= lastT) return null;
  const dayCount = (lastT - firstT) / 86400;
  return {
    totalReturnPct: totalReturnPct(closes),
    cagrPct: cagrPct(closes, dayCount),
    mddPct: mddPct(closes),
    sharpe: sharpe(returnsFromEquity(closes)),
  };
}
