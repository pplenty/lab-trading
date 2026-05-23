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
  /** Buy & Hold (none) — 1차. 주기 rebalance 는 추후. */
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
  /** 비교 baseline — equal weight 동일 종목 시 결과. */
  equalWeightCurve: PortfolioPoint[];
  equalWeightReturn: number;
};

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
  const {positions, initialCapital, feePct, slippagePct} = config;

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
  const perAsset: PerAssetResult[] = normalized.map((p) => {
    const key = `${p.class}:${p.symbol}`;
    const closes = closesBySymbol.get(key)!;
    const firstClose = closes.get(firstT)!;
    const fillPrice = firstClose * (1 + slippagePct);
    const allocation = investable * p.weight;
    const units = fillPrice > 0 ? allocation / fillPrice : 0;
    return {
      class: p.class,
      symbol: p.symbol,
      weight: p.weight,
      units,
      firstClose,
      lastClose: 0,
      finalValue: 0,
      returnPct: 0,
      contributionPct: 0,
    };
  });

  // equity curve — 매 t 에 mark-to-market
  const equityCurve: PortfolioPoint[] = [];
  for (const t of timestamps) {
    let value = 0;
    for (let i = 0; i < normalized.length; i++) {
      const p = normalized[i];
      const key = `${p.class}:${p.symbol}`;
      const close = closesBySymbol.get(key)!.get(t)!;
      value += perAsset[i].units * close;
    }
    equityCurve.push({t, v: value});
  }

  // perAsset finalize
  const lastT = timestamps[timestamps.length - 1];
  let totalFinal = 0;
  for (let i = 0; i < normalized.length; i++) {
    const p = normalized[i];
    const key = `${p.class}:${p.symbol}`;
    const lastClose = closesBySymbol.get(key)!.get(lastT)!;
    perAsset[i].lastClose = lastClose;
    perAsset[i].finalValue = perAsset[i].units * lastClose;
    perAsset[i].returnPct =
      perAsset[i].firstClose > 0
        ? (lastClose / perAsset[i].firstClose - 1) * 100
        : 0;
    totalFinal += perAsset[i].finalValue;
  }
  // contribution = (asset 의 gain) / (portfolio total gain) — gain 기준
  const portfolioGain = totalFinal - initialCapital;
  for (const a of perAsset) {
    const assetGain = a.finalValue - initialCapital * a.weight;
    a.contributionPct =
      Math.abs(portfolioGain) > 0
        ? (assetGain / portfolioGain) * 100
        : 0;
  }

  // equal weight baseline (비교용)
  const equalNormalized = normalized.map((p) => ({...p, weight: 1 / normalized.length}));
  const equalCurve = equityCurveForWeights(
    equalNormalized,
    timestamps,
    closesBySymbol,
    investable
  );
  const equalLast = equalCurve.length > 0 ? equalCurve[equalCurve.length - 1].v : initialCapital;
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
  };
}

function equityCurveForWeights(
  positions: PortfolioPosition[],
  timestamps: number[],
  closesBySymbol: Map<string, Map<number, number>>,
  investable: number
): PortfolioPoint[] {
  const firstT = timestamps[0];
  const units = positions.map((p) => {
    const key = `${p.class}:${p.symbol}`;
    const firstClose = closesBySymbol.get(key)!.get(firstT)!;
    return firstClose > 0 ? (investable * p.weight) / firstClose : 0;
  });
  return timestamps.map((t) => {
    let v = 0;
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const close = closesBySymbol.get(`${p.class}:${p.symbol}`)!.get(t)!;
      v += units[i] * close;
    }
    return {t, v};
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
  };
}
