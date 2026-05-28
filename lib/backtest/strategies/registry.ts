import type {Strategy} from "../types";
import {buyAndHold} from "./buy-and-hold";
import {smaCross} from "./sma-cross";
import {rsiReversion} from "./rsi-reversion";
import {donchianBreakout} from "./donchian-breakout";
import {macdCross} from "./macd-cross";
import {bollingerReversion} from "./bollinger-reversion";
import {trendRsi} from "./trend-rsi";
import {supertrend} from "./supertrend";

// Preset 카탈로그 (ADR-0020). 8 전략:
//   추세추종 4 (sma-cross · donchian-breakout · macd-cross · supertrend)
//   평균회귀 3 (rsi-reversion · bollinger-reversion · trend-rsi)
//   baseline 1 (buy-and-hold)
// 새 preset 추가 시 여기에 등록 → BacktestForm 자동 노출.
export const strategies: Strategy[] = [
  buyAndHold,
  smaCross,
  rsiReversion,
  donchianBreakout,
  macdCross,
  bollingerReversion,
  trendRsi,
  supertrend,
];

export function getStrategy(id: string): Strategy | undefined {
  return strategies.find((s) => s.id === id);
}

export {
  buyAndHold,
  smaCross,
  rsiReversion,
  donchianBreakout,
  macdCross,
  bollingerReversion,
  trendRsi,
  supertrend,
};
