import type {IndicatorField, Strategy} from "../types";

// 고급 Preset — Supertrend (ATR 기반 추세추종).
// 널리 쓰이는 추세 추종 지표. ATR 변동성으로 추세 밴드를 그리고, 종가가 밴드를
// 돌파하면 추세 전환으로 판단.
//
//   hl2 = (high + low) / 2
//   basicUpper = hl2 + multiplier × ATR
//   basicLower = hl2 - multiplier × ATR
//   finalUpper / finalLower 는 직전 값과 종가로 "끈끈하게" 유지 (whipsaw 완화)
//   추세: 종가가 finalUpper 상향 돌파 → 상승, finalLower 하향 돌파 → 하락
//
//   매수: 상승 전환, 매도: 하락 전환.
//
// ATR 은 D1 atr_14 사용 (period 14 고정). multiplier 만 파라미터.
// 추세추종이라 승률은 평균회귀보다 낮을 수 있으나, 추세장에서 큰 수익 포착.

type State = {
  multiplier: number;
  prevFinalUpper: number | undefined;
  prevFinalLower: number | undefined;
  prevClose: number | undefined;
  prevTrend: "up" | "down" | undefined;
};

export const supertrend: Strategy<State> = {
  id: "supertrend",
  name: "Supertrend",
  nameKo: "슈퍼트렌드",
  description:
    "ATR-based trend following. Buy when price flips above the Supertrend line, sell when it flips below.",
  descriptionKo:
    "ATR (변동성) 기반 추세선. 종가가 추세선 위로 전환 시 매수, 아래로 전환 시 매도. 추세장 포착에 강함.",
  params: [
    {
      key: "multiplier",
      label: "ATR multiplier",
      labelKo: "ATR 배수",
      type: "float",
      min: 1,
      max: 6,
      step: 0.5,
      // Supertrend 표준 배수 3.0 (민감도 — 작을수록 잦은 전환).
      default: 3,
    },
  ],
  requiredIndicators(): IndicatorField[] {
    return ["atr_14"];
  },
  validateParams(params) {
    if (!Number.isFinite(params.multiplier) || params.multiplier <= 0) {
      return "multiplier must be positive";
    }
    return null;
  },
  init: (params) => ({
    multiplier: params.multiplier,
    prevFinalUpper: undefined,
    prevFinalLower: undefined,
    prevClose: undefined,
    prevTrend: undefined,
  }),
  onBar: (candle, indicators, state, position) => {
    const atr = indicators?.atr_14;
    if (atr === undefined || atr <= 0) {
      // ATR 미충족 (초기 봉) — 종가만 갱신하고 관망
      state.prevClose = candle.c;
      return "hold";
    }

    const hl2 = (candle.h + candle.l) / 2;
    const basicUpper = hl2 + state.multiplier * atr;
    const basicLower = hl2 - state.multiplier * atr;

    const prevFU = state.prevFinalUpper;
    const prevFL = state.prevFinalLower;
    const prevClose = state.prevClose;

    // finalUpper — 직전보다 낮아지거나 직전 종가가 직전 밴드를 넘었으면 갱신, 아니면 유지
    const finalUpper =
      prevFU === undefined ||
      basicUpper < prevFU ||
      (prevClose !== undefined && prevClose > prevFU)
        ? basicUpper
        : prevFU;
    const finalLower =
      prevFL === undefined ||
      basicLower > prevFL ||
      (prevClose !== undefined && prevClose < prevFL)
        ? basicLower
        : prevFL;

    // 추세 판정
    let trend: "up" | "down";
    if (state.prevTrend === undefined) {
      trend = candle.c >= finalUpper ? "up" : "down";
    } else if (state.prevTrend === "up") {
      trend = candle.c < finalLower ? "down" : "up";
    } else {
      trend = candle.c > finalUpper ? "up" : "down";
    }

    const prevTrend = state.prevTrend;

    // 상태 갱신
    state.prevFinalUpper = finalUpper;
    state.prevFinalLower = finalLower;
    state.prevClose = candle.c;
    state.prevTrend = trend;

    // 추세 전환 시 매매
    if (prevTrend !== undefined && prevTrend !== trend) {
      if (trend === "up" && position === 0) {
        return {
          action: "buy",
          reason: `Supertrend 상승 전환 (종가 > 추세선 ${finalLower.toFixed(2)})`,
        };
      }
      if (trend === "down" && position === 1) {
        return {
          action: "sell",
          reason: `Supertrend 하락 전환 (종가 < 추세선 ${finalUpper.toFixed(2)})`,
        };
      }
    }
    return "hold";
  },
};
