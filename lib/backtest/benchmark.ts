import type {AssetClass, Candle} from "@/lib/types";

// 백테스트 "전략 vs 시장" 벤치마크 — 같은 자산군의 시장 대표 종목(같은 거래 캘린더라 정렬 안전).
//   코인 → BTC(시장 leader) · 미국 → SPY(S&P 500 ETF) · 국내 → KODEX 200(KOSPI 200 ETF).
// 가격(buy&hold) 총수익률 기준 — 수수료 미반영(시장 참조용).

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
