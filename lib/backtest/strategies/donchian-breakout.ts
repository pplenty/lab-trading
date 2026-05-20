import type {Strategy, IndicatorField} from "../types";

// Donchian Breakout (Turtle Trading 스타일).
//   - N일 high 돌파 → buy
//   - M일 low 돌파 → sell
// 추세 추종 (trend-following) 의 가장 단순한 변종.
// D1 사전계산 X — N/M 가 사용자 파라미터라 self-streaming 으로 high/low 윈도우 유지.

type DonchianState = {
  highWindow: number; // N
  lowWindow: number; // M
  highs: number[]; // 최근 봉의 high (windowed)
  lows: number[]; // 최근 봉의 low (windowed)
};

export const donchianBreakout: Strategy<DonchianState> = {
  id: "donchian-breakout",
  name: "Donchian Breakout",
  nameKo: "돈치안 채널 돌파",
  description:
    "Buy when price closes above N-day high; sell when price closes below M-day low. Classic Turtle Trading.",
  descriptionKo:
    "종가가 N일 최고가를 돌파하면 매수, M일 최저가를 하향 돌파하면 매도. 추세 추종 전략의 대표.",
  params: [
    {
      key: "highWindow",
      label: "Breakout high window (N)",
      labelKo: "매수 돌파 기간 N (일)",
      type: "int",
      min: 5,
      max: 200,
      default: 20,
    },
    {
      key: "lowWindow",
      label: "Breakdown low window (M)",
      labelKo: "매도 돌파 기간 M (일)",
      type: "int",
      min: 5,
      max: 200,
      default: 10,
    },
  ],
  requiredIndicators(): IndicatorField[] {
    // 사용자 정의 N/M 라 D1 사전계산 셋과 매칭 안 됨 — self-streaming.
    return [];
  },
  validateParams(params) {
    if (!Number.isInteger(params.highWindow) || !Number.isInteger(params.lowWindow)) {
      return "highWindow and lowWindow must be integers";
    }
    if (params.highWindow < 5 || params.lowWindow < 5) {
      return "windows must be ≥ 5";
    }
    if (params.highWindow > 200 || params.lowWindow > 200) {
      return "windows must be ≤ 200";
    }
    return null;
  },
  init: (params) => ({
    highWindow: params.highWindow,
    lowWindow: params.lowWindow,
    highs: [],
    lows: [],
  }),
  onBar: (candle, _indicators, state, position) => {
    // 직전까지의 최고/최저 계산 (현재 봉 제외 — lookahead 회피).
    let signal: "buy" | "sell" | "hold" = "hold";

    if (state.highs.length >= state.highWindow && position === 0) {
      let priorHigh = -Infinity;
      const start = state.highs.length - state.highWindow;
      for (let i = start; i < state.highs.length; i++) {
        if (state.highs[i] > priorHigh) priorHigh = state.highs[i];
      }
      if (candle.c > priorHigh) signal = "buy";
    }

    if (state.lows.length >= state.lowWindow && position === 1) {
      let priorLow = Infinity;
      const start = state.lows.length - state.lowWindow;
      for (let i = start; i < state.lows.length; i++) {
        if (state.lows[i] < priorLow) priorLow = state.lows[i];
      }
      if (candle.c < priorLow) signal = "sell";
    }

    // 현재 봉의 high/low 누적 (다음 봉 결정에 사용)
    state.highs.push(candle.h);
    state.lows.push(candle.l);
    return signal;
  },
};
