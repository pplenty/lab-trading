import type {Strategy} from "../types";
import {buyAndHold} from "./buy-and-hold";
import {smaCross} from "./sma-cross";
import {rsiReversion} from "./rsi-reversion";
import {donchianBreakout} from "./donchian-breakout";

// Preset 카탈로그 (ADR-0020). 4 전략:
//   buy-and-hold · sma-cross · rsi-reversion · donchian-breakout
// 새 preset 추가 시 여기에 등록 → BacktestForm 자동 노출.
export const strategies: Strategy[] = [
  buyAndHold,
  smaCross,
  rsiReversion,
  donchianBreakout,
];

export function getStrategy(id: string): Strategy | undefined {
  return strategies.find((s) => s.id === id);
}

export {buyAndHold, smaCross, rsiReversion, donchianBreakout};
