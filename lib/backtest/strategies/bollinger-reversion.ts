import type {Strategy, IndicatorField} from "../types";
import {bollinger} from "../indicators";

// Bollinger Bands Mean Reversion.
//   - close < bb_lower 터치 → buy (oversold, 평균 회귀 기대)
//   - close > bb_upper 터치 → sell (overbought)
// 기본 (period=20, σ=2) — D1 사전계산 bb_upper/bb_middle/bb_lower 활용.
// 사용자 정의 파라미터는 self-streaming.

const PRECOMPUTED = {period: 20, stdDev: 2};

type BBState = {
  period: number;
  stdDev: number;
  closes: number[];
};

export const bollingerReversion: Strategy<BBState> = {
  id: "bollinger-reversion",
  name: "Bollinger Bands Mean Reversion",
  nameKo: "볼린저 밴드 평균회귀",
  description:
    "Buy on close below lower band; sell on close above upper band. Mean-reversion classic.",
  descriptionKo:
    "종가가 하단 밴드 아래로 터치하면 매수 (평균 회귀 기대), 상단 밴드 위로 터치하면 매도. 기본 (20, 2σ).",
  params: [
    {
      key: "period",
      label: "SMA period",
      labelKo: "이동평균 기간",
      type: "int",
      min: 5,
      max: 100,
      default: 20,
    },
    {
      key: "stdDev",
      label: "Std Dev multiplier",
      labelKo: "표준편차 배수",
      type: "float",
      min: 1,
      max: 4,
      default: 2,
      step: 0.5,
    },
  ],
  requiredIndicators(params): IndicatorField[] {
    if (
      params.period === PRECOMPUTED.period &&
      params.stdDev === PRECOMPUTED.stdDev
    ) {
      return ["bb_upper", "bb_middle", "bb_lower"];
    }
    return [];
  },
  validateParams(params) {
    if (!Number.isInteger(params.period)) return "period must be integer";
    if (params.period < 5 || params.period > 100) return "period out of range";
    if (params.stdDev < 1 || params.stdDev > 4) return "stdDev out of range";
    return null;
  },
  init: (params) => ({
    period: params.period,
    stdDev: params.stdDev,
    closes: [],
  }),
  onBar: (candle, indicators, state, position) => {
    state.closes.push(candle.c);

    const usePrecomputed =
      state.period === PRECOMPUTED.period &&
      state.stdDev === PRECOMPUTED.stdDev;
    let upper: number | undefined;
    let lower: number | undefined;
    if (usePrecomputed && indicators) {
      upper = indicators.bb_upper;
      lower = indicators.bb_lower;
    }
    if (upper === undefined || lower === undefined) {
      if (state.closes.length < state.period) return "hold";
      const bb = bollinger(state.closes, state.period, state.stdDev);
      const last = bb[bb.length - 1];
      if (!last) return "hold";
      upper = last.upper;
      lower = last.lower;
    }
    if (upper === undefined || lower === undefined) return "hold";

    // 매수: 종가 < 하단 (oversold).
    if (position === 0 && candle.c < lower) {
      return {
        action: "buy",
        reason: `Bollinger 하단 ${lower.toFixed(2)} 이탈 (종가 ${candle.c.toFixed(2)}) — 평균 회귀`,
      };
    }
    // 매도: 종가 > 상단 (overbought).
    if (position === 1 && candle.c > upper) {
      return {
        action: "sell",
        reason: `Bollinger 상단 ${upper.toFixed(2)} 이탈 (종가 ${candle.c.toFixed(2)}) — 평균 회귀`,
      };
    }
    return "hold";
  },
};
