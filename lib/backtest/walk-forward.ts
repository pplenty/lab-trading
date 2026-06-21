import type {Candle} from "@/lib/types";
import type {StrategyParam} from "./types";
import {sweepValues} from "./sweep";

// Walk-forward 강건성 — 백테스트 기간을 앞(in-sample) / 뒤(out-of-sample) 로 나눠,
// IS 구간에서 파라미터를 최적화한 뒤 그 값을 손대지 않은 OOS 구간에 적용해 성과 낙차를
// 본다. 파라미터 민감도 스윕(전체기간=IS 한 점)이 못 답하는 "미래 일반화" 질문을 메움.
// 실행(runBacktest)은 component, 여기는 순수 분할·선택·판정.
// IS run = candles.slice(0, boundaryIdx) (데이터 시작 cold). OOS run = full candles +
// warmupBars=boundaryIdx (IS 전체로 지표 warm, 거래·수익은 OOS 만). 룩어헤드 없음 —
// 워밍업 봉은 미체결, IS 마지막 인덱스 < OOS 첫 인덱스.

export type ISOOSSplit = {
  /** OOS 시작 인덱스. IS=candles.slice(0, boundaryIdx)(슬라이스). OOS 는 full candles +
   * warmupBars=boundaryIdx 로 실행(슬라이스 대신 워밍업 — IS 이력으로 지표 warm). */
  boundaryIdx: number;
  /** OOS 첫 봉 t. */
  boundaryT: number;
  isBars: number;
  oosBars: number;
};

/** 캔들(시간순 가정)을 앞 IS / 뒤 OOS 로 인덱스 분할. 양쪽 최소 minBars 미만이면 null. */
export function splitISOOS(
  candles: Candle[],
  oosFraction = 0.3,
  minBars = 30
): ISOOSSplit | null {
  const n = candles.length;
  if (n < minBars * 2) return null;
  const boundaryIdx = Math.floor(n * (1 - oosFraction));
  const isBars = boundaryIdx;
  const oosBars = n - boundaryIdx;
  if (isBars < minBars || oosBars < minBars) return null;
  return {boundaryIdx, boundaryT: candles[boundaryIdx].t, isBars, oosBars};
}

export type ISBest = {value: number; isPct: number; isTrades: number};

/**
 * IS 구간에서 param 격자 중 총수익 최고 값 선택. run 은 (params)→{pct, trades} | null
 * (invalid 조합) 주입. **IS 무거래(trades<1) 값은 제외** — 거래 안 한 파라미터는
 * 의미 있는 최적화 후보가 아니고(단일 행운 거래 봉우리 완화), 전부 무거래면 null.
 */
export function selectISBest(
  param: StrategyParam,
  baseParams: Record<string, number>,
  run: (params: Record<string, number>) => {pct: number; trades: number} | null
): ISBest | null {
  let best: ISBest | null = null;
  for (const v of sweepValues(param, 24)) {
    const r = run({...baseParams, [param.key]: v});
    if (r === null || r.trades < 1) continue;
    if (best === null || r.pct > best.isPct) {
      best = {value: v, isPct: r.pct, isTrades: r.trades};
    }
  }
  return best;
}

export type WalkForwardVerdict = "robust" | "overfit-suspect" | "inconclusive";

/**
 * IS-best 파라미터가 OOS 에서 얼마나 유지되나 → 낙관(과최적화) 편향 진단.
 * **OOS 무거래(oosTradeCount 0) → inconclusive** (지표 워밍업/신호 부재 — 과최적화 아님).
 * robust: OOS 가 IS-best 절반 이상 + 양수. overfit-suspect: OOS 음수거나 IS 20% 미만.
 * inconclusive: 중간 / IS-best 자체가 미미.
 */
export function walkForwardVerdict(
  isBestPct: number,
  oosPct: number,
  oosTradeCount: number
): WalkForwardVerdict {
  if (oosTradeCount === 0) return "inconclusive";
  if (isBestPct <= 1) return "inconclusive";
  const ratio = oosPct / isBestPct;
  if (oosPct > 0 && ratio >= 0.5) return "robust";
  if (oosPct <= 0 || ratio < 0.2) return "overfit-suspect";
  return "inconclusive";
}

export type WalkForwardResult = {
  paramLabel: string;
  isBestValue: number;
  isPct: number;
  isTrades: number;
  oosPct: number;
  oosTrades: number;
  /** isPct - oosPct (%포인트 낙차). */
  degradationPp: number;
  verdict: WalkForwardVerdict;
  isBars: number;
  oosBars: number;
};
