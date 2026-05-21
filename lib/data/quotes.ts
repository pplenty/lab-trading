import {cache} from "react";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import type {AssetClass, ListQuotesOpts, Quote, RankingKind} from "@/lib/types";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import type {DataAdapter} from "@/lib/adapters/types";
import type {Candle} from "@/lib/types";
import {getQuoteCache, setQuoteCache} from "@/lib/cache/quote-kv";

// adapter 실시간 quote 가 외부 API 한도·차단으로 실패할 때 D1 의 최근 candle 로
// quote 를 합성하는 fallback. backfill 가 채운 D1 가 있으면 어제 종가 + 24h delta 까지 노출 가능.
//
// source 필드로 구분:
//   "upbit" / "twelve-data" / "kis"   — 실시간 라이브
//   "d1-fallback"                       — D1 최근 봉 기반 (라이브 아님, UI 라벨 권장)

const ADAPTERS = {
  crypto: upbitAdapter,
  us: twelveDataAdapter,
  kr: kisAdapter,
} as const satisfies Record<AssetClass, DataAdapter>;

const CURRENCY: Record<AssetClass, string> = {
  crypto: "KRW",
  us: "USD",
  kr: "KRW",
};

const DAY_SEC = 86400;

function quoteFromD1Rows(
  asset: AssetClass,
  symbol: string,
  rows: Candle[]
): Quote | null {
  if (rows.length === 0) return null;
  const sorted = rows.length >= 2 ? [...rows].sort((a, b) => a.t - b.t) : rows;
  const last = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const changeAbs = prev ? last.c - prev.c : 0;
  const changePct = prev && prev.c !== 0 ? (changeAbs / prev.c) * 100 : 0;
  return {
    symbol,
    class: asset,
    price: last.c,
    currency: CURRENCY[asset],
    changeAbs24h: changeAbs,
    changePct24h: changePct,
    volume24h: last.v,
    high24h: last.h,
    low24h: last.l,
    updatedAt: new Date(last.t * 1000).toISOString(),
    source: "d1-fallback",
  };
}

/** D1 의 최근 2 봉으로 Quote 합성. 데이터 없거나 D1 binding 미설정이면 null. */
export async function loadQuoteFromD1(
  asset: AssetClass,
  symbol: string
): Promise<Quote | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const rows = await repo.range({
      symbol,
      from: now - 30 * DAY_SEC, // 휴장 여유 + 신규 종목 대비
      to: now + DAY_SEC,
    });
    return quoteFromD1Rows(asset, symbol, rows);
  } catch {
    return null;
  }
}

/** 여러 종목의 최근 2 봉을 한 번에 읽어 Quote 합성. 리스트/홈 SSR fast path. */
export async function loadQuotesFromD1(
  asset: AssetClass,
  symbols: string[]
): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  if (!(await isDbAvailable())) return [];
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const bySymbol = await repo.recentBySymbols({
      symbols,
      from: now - 30 * DAY_SEC,
      to: now + DAY_SEC,
      perSymbol: 2,
    });
    return symbols
      .map((symbol) => quoteFromD1Rows(asset, symbol, bySymbol.get(symbol) ?? []))
      .filter((q): q is Quote => q !== null);
  } catch {
    return [];
  }
}

/**
 * adapter 라이브 시도 → KV 60s 캐시 → 실패 시 D1 fallback.
 *
 * Layer 1: react.cache() — 같은 RSC render 안에서 dedup (다중 호출 자산 비용 0)
 * Layer 2: KV 60s — 다른 render 간 외부 API 호출 200-500ms → ~5ms
 * Layer 3: D1 fallback — KV miss + 외부 API 실패 시 어제 종가 + delta
 *
 * 정상 흐름 (KV hit): TTFB 단축 200-500ms.
 * 정상 흐름 (KV miss): 외부 fetch 후 KV put (다음 60s 동안 hit).
 */
export const loadQuote = cache(async (
  asset: AssetClass,
  symbol: string
): Promise<Quote> => {
  // Layer 2: KV
  const cached = await getQuoteCache(asset, symbol);
  if (cached) return cached;

  // Layer 3: 외부 API (성공 시 KV put)
  try {
    const fresh = await ADAPTERS[asset].getQuote(symbol);
    // KV put 은 비동기 — 응답 대기 안 하고 fire-and-forget. (await 하면 TTFB 늘어남)
    setQuoteCache(asset, symbol, fresh).catch(() => {});
    return fresh;
  } catch (err) {
    const fallback = await loadQuoteFromD1(asset, symbol);
    if (fallback) return fallback;
    throw err;
  }
});

/**
 * 인덱스 / 대시보드 quote 리스트 — **D1 우선** (~100ms).
 *
 * D1 우선 이유: KIS 직렬 24 종목 + Twelve Data rate-limit fallback 가 SSR 11s+. 인덱스의
 * 가격 표시는 "어제 종가 + 24h 변동" 으로 충분. 종목 상세는 loadQuote (단일 종목 라이브) 유지.
 *
 * (KV cache + preferLive 분기는 dead code 였음 — 호출자 없어서 2026-05-18 제거.)
 */
export async function loadQuotesList(opts: {
  asset: AssetClass;
  symbols: string[];
  listOpts?: ListQuotesOpts;
}): Promise<Quote[]> {
  void opts.listOpts; // 시그너처 호환 — 호출자 일부가 limit 전달, 현재 D1 전체 read 후 호출자가 slice.
  return await loadQuotesFromD1(opts.asset, opts.symbols);
}

/** quote.source 가 D1 fallback 인지 — UI 분기용. */
export function isQuoteFromD1(quote: Quote | null | undefined): boolean {
  return quote?.source === "d1-fallback";
}

/**
 * 자산군 × 랭킹 종류 D1 합성. adapter.rankings 실패 시 fallback.
 * gainers/losers 는 changePct24h, volume 은 volume24h 기준 정렬.
 */
export async function loadRankingsFromD1(opts: {
  asset: AssetClass;
  symbols: string[];
  kind: RankingKind;
  limit?: number;
}): Promise<Quote[]> {
  const quotes = await loadQuotesFromD1(opts.asset, opts.symbols);
  const sorted = (() => {
    switch (opts.kind) {
      case "gainers":
        return [...quotes].sort(
          (a, b) => (b.changePct24h ?? 0) - (a.changePct24h ?? 0)
        );
      case "losers":
        return [...quotes].sort(
          (a, b) => (a.changePct24h ?? 0) - (b.changePct24h ?? 0)
        );
      case "volume":
        return [...quotes].sort(
          (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)
        );
    }
  })();
  return sorted.slice(0, opts.limit ?? 50);
}
