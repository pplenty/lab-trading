import type {Candle} from "@/lib/types";
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
import {getStrategy} from "./strategies/registry";
import type {
  BacktestConfig,
  BacktestResult,
  EquityPoint,
  Position,
  Signal,
  Trade,
} from "./types";

// ADR-0019 백테스트 엔진 코어.
// fillModel:
//   - "next-open" (디폴트): 봉 i 에서 결정한 신호는 봉 i+1 시가에 체결. 룩어헤드 회피.
//   - "same-close": 봉 i 에서 신호 + 같은 봉 종가에 체결. sanity check 용. 실거래엔 비현실적.
// 포지션은 100% or 0% (단일 자산 단일 포지션, ADR-0019 제5결정).
// 수수료/슬리피지/세금 모두 사용자 불리 방향. 매수/매도 양쪽 수수료.

export function runBacktest(config: BacktestConfig): BacktestResult {
  const candles = filterByDateRange(
    config.candles,
    config.startDate,
    config.endDate
  );
  if (candles.length === 0) {
    return emptyResult();
  }
  const strategy = getStrategy(config.strategyId);
  if (!strategy) {
    throw new Error(`runBacktest: unknown strategy ${config.strategyId}`);
  }
  if (strategy.validateParams) {
    const err = strategy.validateParams(config.params);
    if (err) throw new Error(`runBacktest: invalid params — ${err}`);
  }
  const indicators = config.indicators;
  if (indicators && indicators.length !== candles.length) {
    throw new Error(
      `runBacktest: indicators length ${indicators.length} != candles length ${candles.length}`
    );
  }

  const state = strategy.init(config.params);
  const fee = config.feePct;
  const slip = config.slippagePct;
  const tax = config.taxPctOnSell ?? 0;

  let cash = config.initialCapital;
  let size = 0;
  let position: Position = 0;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let pendingSignal: Signal = "hold";

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const indRow = indicators?.[i];

    // 1) next-open 체결 — 이전 봉의 pendingSignal 을 이 봉 시가에 체결.
    if (config.fillModel === "next-open" && pendingSignal !== "hold") {
      if (pendingSignal === "buy" && position === 0) {
        const fillPrice = candle.o * (1 + slip);
        // 100% allocation: 모든 cash 를 매수 (수수료 차감 후).
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
        });
      } else if (pendingSignal === "sell" && position === 1) {
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
        });
      }
      pendingSignal = "hold";
    }

    // 2) 이 봉의 신호 결정 — next-open 모델에선 다음 봉 시가 체결 대기용으로 저장.
    const sig = strategy.onBar(candle, indRow, state, position);

    if (config.fillModel === "same-close") {
      // 같은 봉 종가에 즉시 체결 (룩어헤드).
      if (sig === "buy" && position === 0) {
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
        });
      } else if (sig === "sell" && position === 1) {
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
        });
      }
    } else {
      pendingSignal = sig;
    }

    // 3) 봉 종가 기준 mark-to-market.
    equityCurve.push({t: candle.t, v: cash + size * candle.c});
  }

  // buyHoldCurve — 첫 봉 시가 매수, 끝까지 보유. 수수료/슬리피지 없이 baseline (ADR-0019).
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

function filterByDateRange(
  candles: Candle[],
  startDate: number | undefined,
  endDate: number | undefined
): Candle[] {
  if (startDate === undefined && endDate === undefined) return candles;
  return candles.filter((c) => {
    if (startDate !== undefined && c.t < startDate) return false;
    if (endDate !== undefined && c.t >= endDate) return false;
    return true;
  });
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
