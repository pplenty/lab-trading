import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import type {AssetClass, ListQuotesOpts, Quote, RankingKind} from "@/lib/types";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import type {DataAdapter} from "@/lib/adapters/types";

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
    if (rows.length === 0) return null;
    const last = rows[rows.length - 1];
    const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
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
  } catch {
    return null;
  }
}

/** adapter 라이브 시도 → 실패 시 D1 fallback. 둘 다 실패하면 throw. */
export async function loadQuote(
  asset: AssetClass,
  symbol: string
): Promise<Quote> {
  try {
    return await ADAPTERS[asset].getQuote(symbol);
  } catch (err) {
    const fallback = await loadQuoteFromD1(asset, symbol);
    if (fallback) return fallback;
    throw err;
  }
}

/**
 * adapter.listQuotes 시도 → 실패 시 registry symbols 로 D1 fallback 합성.
 * 인덱스/대시보드 페이지가 외부 API 한도에 영향받지 않도록.
 */
export async function loadQuotesList(opts: {
  asset: AssetClass;
  symbols: string[];
  listOpts?: ListQuotesOpts;
}): Promise<Quote[]> {
  try {
    return await ADAPTERS[opts.asset].listQuotes(opts.listOpts);
  } catch {
    const results = await Promise.all(
      opts.symbols.map((s) => loadQuoteFromD1(opts.asset, s))
    );
    return results.filter((q): q is Quote => q !== null);
  }
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
  const all = await Promise.all(
    opts.symbols.map((s) => loadQuoteFromD1(opts.asset, s))
  );
  const quotes = all.filter((q): q is Quote => q !== null);
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
