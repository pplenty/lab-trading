import type {Strategy} from "../types";
import {buyAndHold} from "./buy-and-hold";
import {smaCross} from "./sma-cross";
import {rsiReversion} from "./rsi-reversion";
import {donchianBreakout} from "./donchian-breakout";
import {macdCross} from "./macd-cross";

// Preset 카탈로그 (ADR-0020). 5 전략:
//   buy-and-hold · sma-cross · rsi-reversion · donchian-breakout · macd-cross
// 새 preset 추가 시 여기에 등록 → BacktestForm 자동 노출.
export const strategies: Strategy[] = [
  buyAndHold,
  smaCross,
  rsiReversion,
  donchianBreakout,
  macdCross,
];

export function getStrategy(id: string): Strategy | undefined {
  return strategies.find((s) => s.id === id);
}

export {buyAndHold, smaCross, rsiReversion, donchianBreakout, macdCross};
