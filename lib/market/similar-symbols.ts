import {cache} from "react";
import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {pearsonCorrelation} from "@/lib/compare/normalize";

// 종목 추천 — daily log returns 의 pearson correlation 으로 자산군 내 비슷한 / 반대 움직임 종목.
// 사용:
//   - 종목 상세 페이지에 "비슷한 움직임" + "반대 움직임" panel
//   - sector 와 별개 (sector 는 분류, correlation 은 실제 움직임)
//
// 캐시: KV 6h (시계열 변동 작음). 자산군 × 종목 × range 단위.

const SECONDS_PER_DAY = 86400;
const RANGE_DAYS = 250; // 1년 — 의미 있는 ρ 위해 충분한 표본 + 너무 길지 않게

export type SimilarSymbol = {
  symbol: string;
  /** -1 ~ 1. */
  correlation: number;
};

export type SimilarSymbolsResult = {
  asset: AssetClass;
  symbol: string;
  /** correlation 내림차순. 자기 자신 제외. */
  topSimilar: SimilarSymbol[];
  /** correlation 오름차순 — 가장 반대 움직임 5개. */
  topOpposite: SimilarSymbol[];
  /** 평균 ρ — 자산군 전체와의 동조도. */
  meanCorrelation: number;
};

function getRegistrySymbols(asset: AssetClass): string[] {
  if (asset === "crypto") {
    return cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol);
  }
  if (asset === "us") {
    return usRegistry.map((e) => e.symbol);
  }
  return krRegistry.map((e) => e.symbol);
}

function emptyResult(asset: AssetClass, symbol: string): SimilarSymbolsResult {
  return {
    asset,
    symbol,
    topSimilar: [],
    topOpposite: [],
    meanCorrelation: 0,
  };
}

function computeDailyReturns(candles: Array<{t: number; c: number}>): number[] {
  if (candles.length < 2) return [];
  const sorted = [...candles].sort((a, b) => a.t - b.t);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].c;
    const curr = sorted[i].c;
    if (prev > 0 && curr > 0) {
      out.push(Math.log(curr / prev));
    }
  }
  return out;
}

async function buildSimilar(
  asset: AssetClass,
  symbol: string
): Promise<SimilarSymbolsResult> {
  if (!(await isDbAvailable())) return emptyResult(asset, symbol);

  const allSymbols = getRegistrySymbols(asset);
  if (!allSymbols.includes(symbol) || allSymbols.length < 2) {
    return emptyResult(asset, symbol);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const from = nowSec - (RANGE_DAYS + 5) * SECONDS_PER_DAY;
  const to = nowSec + SECONDS_PER_DAY;

  const db = await getDb();
  const repo = new D1CandleRepo(db);
  const byMap = await repo.recentBySymbols({
    symbols: allSymbols,
    from,
    to,
    perSymbol: RANGE_DAYS + 5,
  });

  // target 종목 returns
  const targetCandles = byMap.get(symbol);
  if (!targetCandles || targetCandles.length < 30) {
    return emptyResult(asset, symbol);
  }
  const targetReturns = computeDailyReturns(
    targetCandles.map((c) => ({t: c.t, c: c.c}))
  );
  if (targetReturns.length < 20) return emptyResult(asset, symbol);

  // 모든 동료 종목 returns + correlation
  const correlations: SimilarSymbol[] = [];
  for (const other of allSymbols) {
    if (other === symbol) continue;
    const cs = byMap.get(other);
    if (!cs || cs.length < 30) continue;
    const otherReturns = computeDailyReturns(
      cs.map((c) => ({t: c.t, c: c.c}))
    );
    const rho = pearsonCorrelation(targetReturns, otherReturns);
    if (rho === null || !Number.isFinite(rho)) continue;
    correlations.push({symbol: other, correlation: rho});
  }

  if (correlations.length === 0) return emptyResult(asset, symbol);

  const sortedDesc = [...correlations].sort(
    (a, b) => b.correlation - a.correlation
  );
  const sortedAsc = [...correlations].sort(
    (a, b) => a.correlation - b.correlation
  );

  const mean =
    correlations.reduce((s, c) => s + c.correlation, 0) / correlations.length;

  return {
    asset,
    symbol,
    topSimilar: sortedDesc.slice(0, 5),
    topOpposite: sortedAsc.slice(0, 5),
    meanCorrelation: mean,
  };
}

/** 6h KV cache + RSC render cache. */
export const loadSimilarSymbols = cache(
  async (asset: AssetClass, symbol: string): Promise<SimilarSymbolsResult> => {
    const key = `similar:${asset}:${symbol}`;
    const hit = await getKvJson<SimilarSymbolsResult>(key);
    if (hit) return hit;
    const result = await buildSimilar(asset, symbol);
    setKvJson(key, result, {ttlSeconds: 6 * 3600}).catch(() => {});
    return result;
  }
);
