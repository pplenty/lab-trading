// 백테스트 결과 통계 지표 (ADR-0019).
// equity curve / trades 입력 → totalReturn / CAGR / MDD / Sharpe / Sortino / WinRate / avgHoldDays.
// 0 dependency, deterministic.
//
// 연환산 디폴트 — 365 (코인 24/7). 미장은 252, 한국은 245 거래일이 더 정확하지만, 1차 출시는
// 자산군 무관하게 365 적용 (단순화). 자산군별 정확성은 Phase 1.x 의 별도 ADR.

import type {Trade} from "./types";

export const TRADING_DAYS_PER_YEAR = 365;

export function totalReturnPct(equity: number[]): number {
  if (equity.length < 2) return 0;
  const first = equity[0];
  const last = equity[equity.length - 1];
  if (first === 0) return 0;
  return (last / first - 1) * 100;
}

/** CAGR — Compound Annual Growth Rate. dayCount 는 equity 의 시작 ~ 끝 일수. */
export function cagrPct(equity: number[], dayCount: number): number {
  if (equity.length < 2 || dayCount <= 0) return 0;
  const first = equity[0];
  const last = equity[equity.length - 1];
  if (first <= 0 || last <= 0) return 0;
  const years = dayCount / TRADING_DAYS_PER_YEAR;
  if (years === 0) return 0;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

/** Max Drawdown — peak 대비 최대 trough 하락률. 양수 % 로 반환. */
export function mddPct(equity: number[]): number {
  if (equity.length === 0) return 0;
  let peak = equity[0];
  let maxDd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd * 100;
}

/** equity 시계열 → 일간 수익률 시계열. 첫 항목은 제외 (단순화). */
export function returnsFromEquity(equity: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1];
    if (prev === 0) {
      out.push(0);
    } else {
      out.push(equity[i] / prev - 1);
    }
  }
  return out;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mu = mean(xs);
  let s = 0;
  for (const v of xs) {
    const d = v - mu;
    s += d * d;
  }
  return Math.sqrt(s / xs.length);
}

/** Sharpe ratio — risk-free rate 0 가정 (1차 출시 단순화). 연환산. */
export function sharpe(
  dailyReturns: number[],
  periodsPerYear: number = TRADING_DAYS_PER_YEAR
): number {
  if (dailyReturns.length === 0) return 0;
  const sd = stdDev(dailyReturns);
  if (sd === 0) return 0;
  return (mean(dailyReturns) / sd) * Math.sqrt(periodsPerYear);
}

/** Sortino — downside deviation 기준. */
export function sortino(
  dailyReturns: number[],
  periodsPerYear: number = TRADING_DAYS_PER_YEAR
): number {
  if (dailyReturns.length === 0) return 0;
  const downside = dailyReturns.filter((r) => r < 0);
  if (downside.length === 0) return 0;
  const dsd = Math.sqrt(downside.reduce((s, r) => s + r * r, 0) / downside.length);
  if (dsd === 0) return 0;
  return (mean(dailyReturns) / dsd) * Math.sqrt(periodsPerYear);
}

/** round-trip (buy → sell 페어) PnL 이 양수인 비율. */
export function winRatePct(trades: Trade[]): number {
  let wins = 0;
  let total = 0;
  let lastBuy: Trade | undefined;
  for (const tr of trades) {
    if (tr.side === "buy") {
      lastBuy = tr;
    } else if (tr.side === "sell" && lastBuy) {
      total++;
      if (tr.equity > lastBuy.equity) wins++;
      lastBuy = undefined;
    }
  }
  return total === 0 ? 0 : (wins / total) * 100;
}

/** round-trip 평균 보유 일수. trade.t 는 unix epoch seconds. */
export function avgHoldDays(trades: Trade[]): number {
  let totalSeconds = 0;
  let count = 0;
  let lastBuy: Trade | undefined;
  for (const tr of trades) {
    if (tr.side === "buy") {
      lastBuy = tr;
    } else if (tr.side === "sell" && lastBuy) {
      totalSeconds += tr.t - lastBuy.t;
      count++;
      lastBuy = undefined;
    }
  }
  return count === 0 ? 0 : totalSeconds / count / 86400;
}

/** 라운드트립 trade 개수 (buy + sell 한 쌍 = 1). 미체결 매수는 카운트 X. */
export function tradeCount(trades: Trade[]): number {
  let count = 0;
  let hasBuy = false;
  for (const tr of trades) {
    if (tr.side === "buy") {
      hasBuy = true;
    } else if (tr.side === "sell" && hasBuy) {
      count++;
      hasBuy = false;
    }
  }
  return count;
}
