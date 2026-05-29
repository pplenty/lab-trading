import type {Trade} from "./types";

// 백테스트 trade 목록 → 매수/매도 round-trip 페어. 단일 포지션 모델(0% 또는 100%)
// 가정 (CLAUDE.md 컨벤션 P). TradesTable 표시 + CSV export 가 공유.

export type RoundTrip = {
  buy: Trade;
  sell: Trade | null;
  /** 종료된 round-trip 의 절대 손익 (equity 차). 미체결이면 null. */
  pnl: number | null;
  pnlPct: number | null;
  /** 보유 일수. 미체결이면 null. */
  holdDays: number | null;
};

export function pairRoundTrips(trades: Trade[]): RoundTrip[] {
  const trips: RoundTrip[] = [];
  let lastBuy: Trade | null = null;
  for (const tr of trades) {
    if (tr.side === "buy") {
      if (lastBuy) {
        // 직전 buy 가 unclose 였다면 round-trip 으로 카운트 X (단일 포지션 모델에선 발생 X)
        trips.push({buy: lastBuy, sell: null, pnl: null, pnlPct: null, holdDays: null});
      }
      lastBuy = tr;
    } else if (tr.side === "sell" && lastBuy) {
      const pnl = tr.equity - lastBuy.equity;
      const pnlPct = lastBuy.equity > 0 ? (pnl / lastBuy.equity) * 100 : 0;
      const holdDays = (tr.t - lastBuy.t) / 86400;
      trips.push({buy: lastBuy, sell: tr, pnl, pnlPct, holdDays});
      lastBuy = null;
    }
  }
  // 미체결 마지막 buy (open position)
  if (lastBuy) {
    trips.push({buy: lastBuy, sell: null, pnl: null, pnlPct: null, holdDays: null});
  }
  return trips;
}
