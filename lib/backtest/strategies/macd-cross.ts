import type {Strategy, IndicatorField} from "../types";
import {ema} from "../indicators";

// MACD Crossover.
//   - MACD line > Signal line 으로 상향 돌파 → buy
//   - MACD line < Signal line 으로 하향 돌파 → sell
// 기본 (12, 26, 9) — D1 사전계산 macd/macd_signal 활용. 사용자 정의 파라미터는 self-streaming.

const PRECOMPUTED = {fast: 12, slow: 26, signal: 9};

type MacdState = {
  fast: number;
  slow: number;
  signal: number;
  closes: number[];
  prevSign: -1 | 0 | 1;
};

function computeMacdAt(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number
): {macd: number; signal: number} | null {
  if (closes.length < slow + signalPeriod) return null;
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f === undefined || s === undefined) macdLine.push(0);
    else macdLine.push(f - s);
  }
  // signal EMA of macdLine — slow 미만 인 구간 0 으로 들어간 거 무시.
  const startValid = slow - 1;
  const slice = macdLine.slice(startValid);
  if (slice.length < signalPeriod) return null;
  const sig = ema(slice, signalPeriod);
  const lastSig = sig[sig.length - 1];
  if (lastSig === undefined) return null;
  return {macd: macdLine[macdLine.length - 1], signal: lastSig};
}

export const macdCross: Strategy<MacdState> = {
  id: "macd-cross",
  name: "MACD Crossover",
  nameKo: "MACD 교차",
  description:
    "Buy on MACD crossing above its signal line; sell on crossing below. Default (12, 26, 9).",
  descriptionKo:
    "MACD line 이 signal line 을 상향 돌파 시 매수, 하향 돌파 시 매도. 기본 (12, 26, 9).",
  params: [
    {
      key: "fast",
      label: "Fast EMA period",
      labelKo: "단기 EMA 기간",
      type: "int",
      min: 5,
      max: 50,
      default: 12,
    },
    {
      key: "slow",
      label: "Slow EMA period",
      labelKo: "장기 EMA 기간",
      type: "int",
      min: 10,
      max: 100,
      default: 26,
    },
    {
      key: "signal",
      label: "Signal EMA period",
      labelKo: "Signal EMA 기간",
      type: "int",
      min: 3,
      max: 30,
      default: 9,
    },
  ],
  requiredIndicators(params): IndicatorField[] {
    // D1 사전계산 매칭 — 기본 (12, 26, 9) 일 때만.
    if (
      params.fast === PRECOMPUTED.fast &&
      params.slow === PRECOMPUTED.slow &&
      params.signal === PRECOMPUTED.signal
    ) {
      return ["macd", "macd_signal"];
    }
    return [];
  },
  validateParams(params) {
    if (
      !Number.isInteger(params.fast) ||
      !Number.isInteger(params.slow) ||
      !Number.isInteger(params.signal)
    ) {
      return "fast/slow/signal must be integers";
    }
    if (params.fast >= params.slow) return "fast must be less than slow";
    if (params.fast < 5 || params.slow > 100 || params.signal < 3)
      return "out of range";
    return null;
  },
  init: (params) => ({
    fast: params.fast,
    slow: params.slow,
    signal: params.signal,
    closes: [],
    prevSign: 0,
  }),
  onBar: (candle, indicators, state, position) => {
    state.closes.push(candle.c);

    // D1 사전계산 (12, 26, 9) 매칭 시 indicator 직접 사용 — 계산 0.
    const usePrecomputed =
      state.fast === PRECOMPUTED.fast &&
      state.slow === PRECOMPUTED.slow &&
      state.signal === PRECOMPUTED.signal;
    let macd: number | undefined;
    let signal: number | undefined;
    if (usePrecomputed && indicators) {
      macd = indicators.macd;
      signal = indicators.macd_signal;
    }
    if (macd === undefined || signal === undefined) {
      const c = computeMacdAt(
        state.closes,
        state.fast,
        state.slow,
        state.signal
      );
      if (!c) return "hold";
      macd = c.macd;
      signal = c.signal;
    }

    const sign: -1 | 0 | 1 =
      macd > signal ? 1 : macd < signal ? -1 : 0;
    const prevSign = state.prevSign;
    state.prevSign = sign;

    if (prevSign === 0) return "hold";

    if (sign === 1 && prevSign !== 1 && position === 0) return "buy";
    if (sign === -1 && prevSign !== -1 && position === 1) return "sell";
    return "hold";
  },
};
