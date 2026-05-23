import type {AssetClass, Candle} from "@/lib/types";
import {
  cagrPct,
  mddPct,
  returnsFromEquity,
  sharpe,
  sortino,
  totalReturnPct,
} from "./metrics";

// 다중 종목 포트폴리오 백테스트 (ADR-0019 1차 출시 확장).
// 단일 자산 백테스트 (runBacktest) 와 별개 — Position 0|1 대신 weight allocation.
//
// 모델 (1차 MVP):
//   - Buy & Hold: 첫 시점 weight 비중대로 매수, 끝까지 보유
//   - Rebalancing (옵션): 주기적 (monthly/quarterly/yearly) weight 회복
//
// 휴장 처리: 종목별 봉 timestamp 다를 수 있음. intersection 시점만 사용
// (모든 종목 봉 있는 t).

export type PortfolioPosition = {
  class: AssetClass;
  symbol: string;
  /** 0-1 비중. 총합 = 1 (caller 가 normalize). */
  weight: number;
  /** 종목 candles — 같은 range 로 fetch 됐다고 가정. */
  candles: Candle[];
};

export type RebalanceMode = "none" | "monthly" | "quarterly" | "yearly";

export type PortfolioConfig = {
  positions: PortfolioPosition[];
  initialCapital: number;
  /** Buy & Hold (none) 또는 주기적 rebalance (monthly/quarterly/yearly). */
  rebalance: RebalanceMode;
  feePct: number;
  slippagePct: number;
};

export type PortfolioPoint = {t: number; v: number};

export type PerAssetResult = {
  class: AssetClass;
  symbol: string;
  weight: number;
  /** 시작 단위 수 (initial_capital × weight / firstClose). */
  units: number;
  firstClose: number;
  lastClose: number;
  /** 자산별 최종 가치 (units × lastClose). */
  finalValue: number;
  /** 자산별 수익률 % (lastClose / firstClose - 1) × 100. */
  returnPct: number;
  /** 포트폴리오 총 수익 중 이 자산의 contribution %. */
  contributionPct: number;
};

export type PortfolioResult = {
  equityCurve: PortfolioPoint[];
  perAsset: PerAssetResult[];
  metrics: {
    totalReturnPct: number;
    cagrPct: number;
    mddPct: number;
    sharpe: number;
    sortino: number;
  };
  /** 비교 baseline — equal weight 동일 종목 시 결과 (같은 rebalance mode). */
  equalWeightCurve: PortfolioPoint[];
  equalWeightReturn: number;
  /** rebalance 발생 횟수 (none 이면 0). */
  rebalanceCount: number;
  /** rebalance 로 발생한 누적 수수료+슬리피지 (통화 단위). */
  rebalanceCost: number;
};

/** prev/curr unix timestamp (초) 가 rebalance 주기 경계인지. */
function isPeriodBoundary(
  prevTs: number,
  currTs: number,
  mode: RebalanceMode
): boolean {
  if (mode === "none") return false;
  const pd = new Date(prevTs * 1000);
  const cd = new Date(currTs * 1000);
  const pyear = pd.getUTCFullYear();
  const cyear = cd.getUTCFullYear();
  const pmonth = pd.getUTCMonth();
  const cmonth = cd.getUTCMonth();
  if (mode === "yearly") return pyear !== cyear;
  if (mode === "quarterly") {
    return pyear !== cyear || Math.floor(pmonth / 3) !== Math.floor(cmonth / 3);
  }
  // monthly
  return pyear !== cyear || pmonth !== cmonth;
}

/**
 * 종목별 candles 의 timestamp intersection — 모든 종목 봉 있는 t 만.
 * 결과: 정렬된 t 배열 + 종목별 close map.
 */
function intersectTimestamps(
  positions: PortfolioPosition[]
): {timestamps: number[]; closesBySymbol: Map<string, Map<number, number>>} {
  if (positions.length === 0) {
    return {timestamps: [], closesBySymbol: new Map()};
  }
  const closesBySymbol = new Map<string, Map<number, number>>();
  let common: Set<number> | null = null;
  for (const p of positions) {
    const m = new Map<number, number>();
    for (const c of p.candles) m.set(c.t, c.c);
    closesBySymbol.set(`${p.class}:${p.symbol}`, m);
    const tSet = new Set(p.candles.map((c) => c.t));
    if (common === null) common = tSet;
    else {
      const next = new Set<number>();
      for (const t of tSet) if (common.has(t)) next.add(t);
      common = next;
    }
  }
  const timestamps = common ? [...common].sort((a, b) => a - b) : [];
  return {timestamps, closesBySymbol};
}

export function runPortfolioBacktest(config: PortfolioConfig): PortfolioResult {
  const {positions, initialCapital, feePct, slippagePct, rebalance} = config;

  // weight normalize (caller 가 이미 한 거 검증)
  const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) {
    return emptyResult(initialCapital);
  }
  const normalized = positions.map((p) => ({
    ...p,
    weight: p.weight / totalWeight,
  }));

  const {timestamps, closesBySymbol} = intersectTimestamps(normalized);
  if (timestamps.length < 2) {
    return emptyResult(initialCapital);
  }

  const firstT = timestamps[0];
  const investable = initialCapital * (1 - feePct);

  // 첫 시점 매수 — weight 비중대로 units 계산
  const targetWeights = normalized.map((p) => p.weight);
  const initialUnits: number[] = normalized.map((p, i) => {
    const key = `${p.class}:${p.symbol}`;
    const closes = closesBySymbol.get(key)!;
    const firstClose = closes.get(firstT)!;
    const fillPrice = firstClose * (1 + slippagePct);
    const allocation = investable * targetWeights[i];
    return fillPrice > 0 ? allocation / fillPrice : 0;
  });

  // working units state (rebalance 시 갱신)
  const units = [...initialUnits];
  let rebalanceCount = 0;
  let rebalanceCost = 0;

  // equity curve — 매 t 에 mark-to-market (+ boundary 시 rebalance)
  const equityCurve: PortfolioPoint[] = [];
  for (let ti = 0; ti < timestamps.length; ti++) {
    const t = timestamps[ti];

    // boundary 검사 — 같은 t 에 rebalance 후 mark-to-market.
    if (
      ti > 0 &&
      rebalance !== "none" &&
      isPeriodBoundary(timestamps[ti - 1], t, rebalance)
    ) {
      // 현재 mark-to-market 으로 total value 계산
      let totalValue = 0;
      for (let i = 0; i < normalized.length; i++) {
        const close = closesBySymbol
          .get(`${normalized[i].class}:${normalized[i].symbol}`)!
          .get(t)!;
        totalValue += units[i] * close;
      }
      // target value 별 units 재조정 + trade cost
      for (let i = 0; i < normalized.length; i++) {
        const close = closesBySymbol
          .get(`${normalized[i].class}:${normalized[i].symbol}`)!
          .get(t)!;
        const targetValue = totalValue * targetWeights[i];
        const newUnits = close > 0 ? targetValue / close : 0;
        const tradeNotional = Math.abs(newUnits - units[i]) * close;
        rebalanceCost += tradeNotional * (feePct + slippagePct);
        units[i] = newUnits;
      }
      rebalanceCount++;
    }

    // mark-to-market — rebalance cost 차감
    let value = 0;
    for (let i = 0; i < normalized.length; i++) {
      const close = closesBySymbol
        .get(`${normalized[i].class}:${normalized[i].symbol}`)!
        .get(t)!;
      value += units[i] * close;
    }
    equityCurve.push({t, v: value - rebalanceCost});
  }

  // perAsset finalize — units 는 최종 units, returnPct 는 자산 단위.
  const lastT = timestamps[timestamps.length - 1];
  const perAsset: PerAssetResult[] = normalized.map((p, i) => {
    const key = `${p.class}:${p.symbol}`;
    const firstClose = closesBySymbol.get(key)!.get(firstT)!;
    const lastClose = closesBySymbol.get(key)!.get(lastT)!;
    return {
      class: p.class,
      symbol: p.symbol,
      weight: targetWeights[i],
      units: units[i],
      firstClose,
      lastClose,
      finalValue: units[i] * lastClose,
      returnPct: firstClose > 0 ? (lastClose / firstClose - 1) * 100 : 0,
      contributionPct: 0,
    };
  });
  const totalFinal = perAsset.reduce((s, a) => s + a.finalValue, 0) - rebalanceCost;
  const portfolioGain = totalFinal - initialCapital;
  for (const a of perAsset) {
    const assetGain = a.finalValue - initialCapital * a.weight;
    a.contributionPct =
      Math.abs(portfolioGain) > 0 ? (assetGain / portfolioGain) * 100 : 0;
  }

  // equal weight baseline (같은 rebalance mode — fair comparison)
  const equalCurve = equityCurveForWeights(
    normalized,
    timestamps,
    closesBySymbol,
    investable,
    normalized.map(() => 1 / normalized.length),
    rebalance,
    feePct,
    slippagePct
  );
  const equalLast =
    equalCurve.length > 0 ? equalCurve[equalCurve.length - 1].v : initialCapital;
  const equalWeightReturn = (equalLast / initialCapital - 1) * 100;

  // metrics
  const equityValues = equityCurve.map((p) => p.v);
  const dailyReturns = returnsFromEquity(equityValues);
  const dayCount =
    timestamps.length > 1
      ? (timestamps[timestamps.length - 1] - timestamps[0]) / 86400
      : 1;

  return {
    equityCurve,
    perAsset,
    metrics: {
      totalReturnPct: totalReturnPct(equityValues),
      cagrPct: cagrPct(equityValues, dayCount),
      mddPct: mddPct(equityValues),
      sharpe: sharpe(dailyReturns),
      sortino: sortino(dailyReturns),
    },
    equalWeightCurve: equalCurve,
    equalWeightReturn,
    rebalanceCount,
    rebalanceCost,
  };
}

function equityCurveForWeights(
  positions: PortfolioPosition[],
  timestamps: number[],
  closesBySymbol: Map<string, Map<number, number>>,
  investable: number,
  weights: number[],
  rebalance: RebalanceMode = "none",
  feePct = 0,
  slippagePct = 0
): PortfolioPoint[] {
  const firstT = timestamps[0];
  const units = positions.map((p, i) => {
    const key = `${p.class}:${p.symbol}`;
    const firstClose = closesBySymbol.get(key)!.get(firstT)!;
    return firstClose > 0 ? (investable * weights[i]) / firstClose : 0;
  });
  let cost = 0;
  return timestamps.map((t, ti) => {
    if (
      ti > 0 &&
      rebalance !== "none" &&
      isPeriodBoundary(timestamps[ti - 1], t, rebalance)
    ) {
      let totalValue = 0;
      for (let i = 0; i < positions.length; i++) {
        const close = closesBySymbol
          .get(`${positions[i].class}:${positions[i].symbol}`)!
          .get(t)!;
        totalValue += units[i] * close;
      }
      for (let i = 0; i < positions.length; i++) {
        const close = closesBySymbol
          .get(`${positions[i].class}:${positions[i].symbol}`)!
          .get(t)!;
        const targetValue = totalValue * weights[i];
        const newUnits = close > 0 ? targetValue / close : 0;
        cost += Math.abs(newUnits - units[i]) * close * (feePct + slippagePct);
        units[i] = newUnits;
      }
    }
    let v = 0;
    for (let i = 0; i < positions.length; i++) {
      const close = closesBySymbol
        .get(`${positions[i].class}:${positions[i].symbol}`)!
        .get(t)!;
      v += units[i] * close;
    }
    return {t, v: v - cost};
  });
}

function emptyResult(initialCapital: number): PortfolioResult {
  void initialCapital;
  return {
    equityCurve: [],
    perAsset: [],
    metrics: {
      totalReturnPct: 0,
      cagrPct: 0,
      mddPct: 0,
      sharpe: 0,
      sortino: 0,
    },
    equalWeightCurve: [],
    equalWeightReturn: 0,
    rebalanceCount: 0,
    rebalanceCost: 0,
  };
}
