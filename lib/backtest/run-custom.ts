import type {Candle, IndicatorRow} from "@/lib/types";
import {
  avgHoldDays,
  cagrPct,
  mddPct,
  returnsFromEquity,
  sharpe,
  sortino,
  totalReturnPct,
  tradeCount,
  winRatePct,
} from "./metrics";
import type {
  BacktestResult,
  EquityPoint,
  FillModel,
  Position,
  SignalDetail,
  Trade,
} from "./types";
import {
  evaluateGroup,
  formatGroup,
  type CustomConfig,
} from "./conditions";

// run.ts 의 same simulation + custom signal generator.
// preset strategy.onBar 대신 evaluateGroup(buy/sell, candle, indicators) 으로 신호 생성.
// 매 봉마다: buy 조건 → "buy", sell 조건 → "sell", 둘 다 → buy 우선, 둘 다 X → hold.

export type CustomBacktestConfig = {
  candles: Candle[];
  indicators: IndicatorRow[];
  custom: CustomConfig;
  initialCapital: number;
  feePct: number;
  slippagePct: number;
  taxPctOnSell?: number;
  fillModel: FillModel;
};

export function runCustomBacktest(
  config: CustomBacktestConfig
): BacktestResult {
  const {candles, indicators, custom} = config;
  if (candles.length === 0) return emptyResult();
  if (indicators.length !== candles.length) {
    throw new Error(
      `runCustomBacktest: indicators length ${indicators.length} != candles length ${candles.length}`
    );
  }

  const fee = config.feePct;
  const slip = config.slippagePct;
  const tax = config.taxPctOnSell ?? 0;

  const buyReason = formatGroup(custom.buy);
  const sellReason = formatGroup(custom.sell);

  let cash = config.initialCapital;
  let size = 0;
  let position: Position = 0;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let pendingSignal: SignalDetail = {action: "hold"};

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const indRow = indicators[i];
    const prevCandle = i > 0 ? candles[i - 1] : undefined;
    const prevRow = i > 0 ? indicators[i - 1] : undefined;

    // 1) next-open 체결 — 이전 봉 pendingSignal 체결.
    if (config.fillModel === "next-open" && pendingSignal.action !== "hold") {
      if (pendingSignal.action === "buy" && position === 0) {
        const fillPrice = candle.o * (1 + slip);
        const investable = cash * (1 - fee);
        size = investable / fillPrice;
        cash = 0;
        position = 1;
        trades.push({
          side: "buy",
          t: candle.t,
          price: fillPrice,
          size,
          cash,
          equity: cash + size * candle.c,
          reason: pendingSignal.reason,
        });
      } else if (pendingSignal.action === "sell" && position === 1) {
        const fillPrice = candle.o * (1 - slip);
        const gross = size * fillPrice;
        cash = gross * (1 - fee) * (1 - tax);
        size = 0;
        position = 0;
        trades.push({
          side: "sell",
          t: candle.t,
          price: fillPrice,
          size,
          cash,
          equity: cash,
          reason: pendingSignal.reason,
        });
      }
      pendingSignal = {action: "hold"};
    }

    // 2) 이 봉의 signal 결정 (custom condition group).
    let sig: SignalDetail = {action: "hold"};
    if (position === 0) {
      const buy = evaluateGroup(custom.buy, candle, indRow, prevCandle, prevRow);
      if (buy) sig = {action: "buy", reason: buyReason};
    } else {
      const sell = evaluateGroup(custom.sell, candle, indRow, prevCandle, prevRow);
      if (sell) sig = {action: "sell", reason: sellReason};
    }

    if (config.fillModel === "same-close") {
      if (sig.action === "buy" && position === 0) {
        const fillPrice = candle.c * (1 + slip);
        const investable = cash * (1 - fee);
        size = investable / fillPrice;
        cash = 0;
        position = 1;
        trades.push({
          side: "buy",
          t: candle.t,
          price: fillPrice,
          size,
          cash,
          equity: cash + size * candle.c,
          reason: sig.reason,
        });
      } else if (sig.action === "sell" && position === 1) {
        const fillPrice = candle.c * (1 - slip);
        const gross = size * fillPrice;
        cash = gross * (1 - fee) * (1 - tax);
        size = 0;
        position = 0;
        trades.push({
          side: "sell",
          t: candle.t,
          price: fillPrice,
          size,
          cash,
          equity: cash,
          reason: sig.reason,
        });
      }
    } else {
      pendingSignal = sig;
    }

    equityCurve.push({t: candle.t, v: cash + size * candle.c});
  }

  // buy & hold baseline
  const buyHoldCurve = computeBuyHoldCurve(candles, config.initialCapital);

  const equityValues = equityCurve.map((p) => p.v);
  const dailyReturns = returnsFromEquity(equityValues);
  const dayCount =
    candles.length > 1
      ? (candles[candles.length - 1].t - candles[0].t) / 86400
      : 1;

  return {
    trades,
    equityCurve,
    buyHoldCurve,
    metrics: {
      totalReturnPct: totalReturnPct(equityValues),
      cagrPct: cagrPct(equityValues, dayCount),
      mddPct: mddPct(equityValues),
      sharpe: sharpe(dailyReturns),
      sortino: sortino(dailyReturns),
      winRatePct: winRatePct(trades),
      tradeCount: tradeCount(trades),
      avgHoldDays: avgHoldDays(trades),
    },
  };
}

function computeBuyHoldCurve(
  candles: Candle[],
  initialCapital: number
): EquityPoint[] {
  if (candles.length === 0) return [];
  const firstOpen = candles[0].o;
  if (firstOpen <= 0) {
    return candles.map((c) => ({t: c.t, v: initialCapital}));
  }
  const units = initialCapital / firstOpen;
  return candles.map((c) => ({t: c.t, v: units * c.c}));
}

function emptyResult(): BacktestResult {
  return {
    trades: [],
    equityCurve: [],
    buyHoldCurve: [],
    metrics: {
      totalReturnPct: 0,
      cagrPct: 0,
      mddPct: 0,
      sharpe: 0,
      sortino: 0,
      winRatePct: 0,
      tradeCount: 0,
      avgHoldDays: 0,
    },
  };
}
