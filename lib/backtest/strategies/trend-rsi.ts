import type {IndicatorField, Strategy} from "../types";

// 고급 Preset — Trend-Filtered RSI (추세 필터 RSI).
// 핵심: "강세장에서만 dip 매수" — 추세를 거스르지 않아 승률 지향.
//   - 매수: close > SMA200 (강세 추세) AND RSI < oversold (단기 과매도 dip)
//   - 매도: RSI > overbought (과매수 차익) OR close < SMA200 (추세 이탈 손절)
//
// 순수 RSI 역추세 (rsi-reversion) 대비: 하락장 매수를 추세 필터로 차단 →
// "떨어지는 칼날 잡기" 회피. 승률 ↑ (단 강세장 한정이라 거래 수는 적음).
//
// D1 사전계산 (rsi_14, sma_200) 만 사용 — 파라미터는 임계값만 (period 고정).

type State = {
  oversold: number;
  overbought: number;
};

export const trendRsi: Strategy<State> = {
  id: "trend-rsi",
  name: "Trend-Filtered RSI",
  nameKo: "추세 필터 RSI",
  description:
    "Buy RSI dips only in an uptrend (close > SMA200); exit on overbought RSI or trend break. Win-rate oriented.",
  descriptionKo:
    "강세장 (종가 > SMA200) 에서만 RSI 과매도 dip 매수, 과매수 또는 추세 이탈 (종가 < SMA200) 시 매도. 하락장 매수 차단 → 승률 지향.",
  params: [
    {
      key: "oversold",
      label: "Oversold (buy)",
      labelKo: "과매도 매수 임계",
      type: "int",
      min: 10,
      max: 50,
      // 강세장 dip 은 깊지 않은 경우가 많아 30 보다 약간 높게 (35) — 진입 기회 ↑.
      default: 35,
    },
    {
      key: "overbought",
      label: "Overbought (sell)",
      labelKo: "과매수 매도 임계",
      type: "int",
      min: 50,
      max: 90,
      default: 65,
    },
  ],
  requiredIndicators(): IndicatorField[] {
    return ["rsi_14", "sma_200"];
  },
  validateParams(params) {
    if (!Number.isInteger(params.oversold) || !Number.isInteger(params.overbought)) {
      return "oversold / overbought must be integers";
    }
    if (params.oversold >= params.overbought) {
      return "oversold must be less than overbought";
    }
    return null;
  },
  init: (params) => ({
    oversold: params.oversold,
    overbought: params.overbought,
  }),
  onBar: (candle, indicators, state, position) => {
    const rsi = indicators?.rsi_14;
    const sma200 = indicators?.sma_200;
    // SMA200 / RSI 미충족 (초기 200 봉 등) → 관망
    if (rsi === undefined || sma200 === undefined) return "hold";

    const inUptrend = candle.c > sma200;

    if (position === 0) {
      if (inUptrend && rsi < state.oversold) {
        return {
          action: "buy",
          reason: `강세장 (종가 > SMA200) + RSI ${rsi.toFixed(1)} 과매도 dip`,
        };
      }
      return "hold";
    }

    // 보유 중 — 과매수 차익 또는 추세 이탈 손절
    if (!inUptrend) {
      return {
        action: "sell",
        reason: `추세 이탈 (종가 < SMA200) — 손절/청산`,
      };
    }
    if (rsi > state.overbought) {
      return {
        action: "sell",
        reason: `RSI ${rsi.toFixed(1)} 과매수 — 차익 실현`,
      };
    }
    return "hold";
  },
};
