import type {Strategy} from "../types";
import {buyAndHold} from "./buy-and-hold";
import {smaCross} from "./sma-cross";
import {rsiReversion} from "./rsi-reversion";

// 1차 출시 Preset 3종 카탈로그 (ADR-0020).
// 새 preset 추가 시 여기에 등록 → BacktestForm 자동 노출.
export const strategies: Strategy[] = [buyAndHold, smaCross, rsiReversion];

export function getStrategy(id: string): Strategy | undefined {
  return strategies.find((s) => s.id === id);
}

export {buyAndHold, smaCross, rsiReversion};
