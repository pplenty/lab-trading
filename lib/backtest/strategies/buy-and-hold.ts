import type {Strategy} from "../types";

// ADR-0020 Preset 1.
// 첫 봉(또는 position=0 인 첫 호출)에서 매수, 끝까지 hold.
// 모든 백테스트 결과에 baseline 으로 자동 포함되지만, 사용자가 명시적으로 선택할 수도 있음.

export const buyAndHold: Strategy<{bought: boolean}> = {
  id: "buy-and-hold",
  name: "Buy and Hold",
  nameKo: "매수 후 보유",
  description: "Enter at the first bar and hold to the end.",
  descriptionKo: "첫 봉에 진입 후 마지막까지 보유.",
  params: [],
  requiredIndicators: () => [],
  init: () => ({bought: false}),
  onBar: (_candle, _indicators, state, position) => {
    if (position === 0 && !state.bought) {
      state.bought = true;
      return {action: "buy", reason: "시작 시점 단순 매수"};
    }
    return "hold";
  },
};
