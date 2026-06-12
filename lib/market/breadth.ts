import type {Quote} from "@/lib/types";

// 시장 폭(market breadth / advance-decline) — 자산군 인덱스 페이지의 "시장 한눈에" 요약.
// 로드된 quotes 만으로 계산(외부 fetch 0). 공포·탐욕 지수(심리)와 짝이 되는 객관적 시장 지표.

export type MarketBreadth = {
  total: number;
  up: number;
  down: number;
  flat: number;
  /** 단순 평균 24h 변동률(%). */
  avgChangePct: number;
  /** 상승 종목 비율 0..1 (advance ratio). */
  upRatio: number;
  topGainer: {symbol: string; changePct: number} | null;
  topLoser: {symbol: string; changePct: number} | null;
};

/** quotes → 시장 폭 요약. 빈 배열이면 null. */
export function computeMarketBreadth(quotes: Quote[]): MarketBreadth | null {
  if (quotes.length === 0) return null;
  let up = 0;
  let down = 0;
  let flat = 0;
  let sum = 0;
  let topGainer: {symbol: string; changePct: number} | null = null;
  let topLoser: {symbol: string; changePct: number} | null = null;
  for (const q of quotes) {
    const ch = q.changePct24h;
    if (ch > 0) up++;
    else if (ch < 0) down++;
    else flat++;
    sum += ch;
    if (topGainer === null || ch > topGainer.changePct) {
      topGainer = {symbol: q.symbol, changePct: ch};
    }
    if (topLoser === null || ch < topLoser.changePct) {
      topLoser = {symbol: q.symbol, changePct: ch};
    }
  }
  const total = quotes.length;
  return {
    total,
    up,
    down,
    flat,
    avgChangePct: sum / total,
    upRatio: up / total,
    topGainer,
    topLoser,
  };
}
