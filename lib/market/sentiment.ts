import {cache} from "react";
import type {AssetClass, Quote} from "@/lib/types";
import {loadQuotesFromD1} from "@/lib/data/quotes";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";

// 시장 sentiment — 자산군 × 80 종목의 24h 변동 통계.
// D1 candles 기반 (loadQuotesFromD1 의 recentBySymbols 활용).
// KV cache 300s — ISR + cron 5분 정합.

export type SentimentSnapshot = {
  asset: AssetClass;
  totalCount: number;
  /** 24h changePct > 0 종목 수. */
  upCount: number;
  /** changePct < 0. */
  downCount: number;
  /** changePct == 0 또는 변동 없음. */
  flatCount: number;
  /** 평균 24h 변동률 (모든 종목). */
  avgChangePct: number;
  /** 중간값 24h 변동률. */
  medianChangePct: number;
  /** 가장 많이 오른 3 종목. */
  topGainers: Array<{symbol: string; changePct: number; price: number; currency: string}>;
  /** 가장 많이 내린 3 종목. */
  topLosers: Array<{symbol: string; changePct: number; price: number; currency: string}>;
  /** 자산군 전체 거래대금 (24h volume × 평균가). */
  totalVolume: number;
};

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function buildSnapshot(asset: AssetClass, quotes: Quote[]): SentimentSnapshot {
  const changes = quotes
    .map((q) => q.changePct24h)
    .filter((v): v is number => v !== undefined && Number.isFinite(v));
  const upCount = quotes.filter((q) => (q.changePct24h ?? 0) > 0).length;
  const downCount = quotes.filter((q) => (q.changePct24h ?? 0) < 0).length;
  const flatCount = quotes.length - upCount - downCount;
  const avg =
    changes.length > 0
      ? changes.reduce((s, v) => s + v, 0) / changes.length
      : 0;

  const sortedByChange = [...quotes].sort(
    (a, b) => (b.changePct24h ?? 0) - (a.changePct24h ?? 0)
  );
  const topGainers = sortedByChange.slice(0, 3).map((q) => ({
    symbol: q.symbol,
    changePct: q.changePct24h ?? 0,
    price: q.price,
    currency: q.currency,
  }));
  const topLosers = sortedByChange
    .slice(-3)
    .reverse()
    .map((q) => ({
      symbol: q.symbol,
      changePct: q.changePct24h ?? 0,
      price: q.price,
      currency: q.currency,
    }));

  const totalVolume = quotes.reduce((s, q) => s + (q.volume24h ?? 0), 0);

  return {
    asset,
    totalCount: quotes.length,
    upCount,
    downCount,
    flatCount,
    avgChangePct: avg,
    medianChangePct: median(changes),
    topGainers,
    topLosers,
    totalVolume,
  };
}

/** server-side KV cache + D1 합성. 300s TTL. */
export const loadSentiment = cache(
  async (asset: AssetClass, symbols: string[]): Promise<SentimentSnapshot> => {
    const key = `sentiment:${asset}`;
    const hit = await getKvJson<SentimentSnapshot>(key);
    if (hit) return hit;

    const quotes = await loadQuotesFromD1(asset, symbols);
    const snapshot = buildSnapshot(asset, quotes);
    setKvJson(key, snapshot, {ttlSeconds: 300}).catch(() => {});
    return snapshot;
  }
);
