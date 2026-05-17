import type {KVNamespace} from "@cloudflare/workers-types";
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

// 5분 TTL — GitHub Actions cron 가 매 5분 warm-up 호출하므로 첫 사용자도 항상 KV hit.
const KV_QUOTES_TTL_SEC = 300;

async function getKvCache(): Promise<KVNamespace | null> {
  try {
    const {getCloudflareContext} = await import("@opennextjs/cloudflare");
    let env: unknown;
    try {
      env = getCloudflareContext().env;
    } catch {
      env = (await getCloudflareContext({async: true})).env;
    }
    const e = env as {lab_trading_cache?: KVNamespace};
    return e.lab_trading_cache ?? null;
  } catch {
    return null;
  }
}

/**
 * 인덱스 / 대시보드 quote 리스트 — **D1 우선** (디폴트, ~100ms).
 * 라이브 가격이 필요한 호출은 `preferLive: true` 명시. 그 경우 KV cache + adapter +
 * partial fallback 3 layer 동작.
 *
 * D1 우선 이유: KIS 직렬 24 종목 + Twelve Data rate-limit fallback 가 SSR 11s+. 인덱스의
 * 가격 표시는 "어제 종가 + 24h 변동" 으로 충분 — 라이브성 양보로 속도 100배. 종목 상세는
 * loadQuote (단일 종목 라이브 빠름) 유지.
 */
export async function loadQuotesList(opts: {
  asset: AssetClass;
  symbols: string[];
  listOpts?: ListQuotesOpts;
  /** 라이브 시도 + KV cache + partial fallback. 기본 false (D1 우선). */
  preferLive?: boolean;
}): Promise<Quote[]> {
  if (!opts.preferLive) {
    // D1 우선 — 모든 종목 D1 last candle 합성
    const rows = await Promise.all(
      opts.symbols.map((s) => loadQuoteFromD1(opts.asset, s))
    );
    return rows.filter((q): q is Quote => q !== null);
  }

  // preferLive: 라이브 시도 + 부분 fallback + KV cache (기존 로직)
  const kv = await getKvCache();
  const kvKey = `quotes:${opts.asset}`;
  if (kv) {
    try {
      const cached = await kv.get(kvKey, "json");
      if (cached && Array.isArray(cached)) return cached as Quote[];
    } catch {
      // KV miss
    }
  }

  let liveQuotes: Quote[] = [];
  try {
    liveQuotes = await ADAPTERS[opts.asset].listQuotes(opts.listOpts);
  } catch {
    const all = await Promise.all(
      opts.symbols.map((s) => loadQuoteFromD1(opts.asset, s))
    );
    return all.filter((q): q is Quote => q !== null);
  }

  const haveSymbols = new Set(liveQuotes.map((q) => q.symbol));
  const missing = opts.symbols.filter((s) => !haveSymbols.has(s));
  let result = liveQuotes;
  if (missing.length > 0) {
    const fallbacks = await Promise.all(
      missing.map((s) => loadQuoteFromD1(opts.asset, s))
    );
    result = [
      ...liveQuotes,
      ...fallbacks.filter((q): q is Quote => q !== null),
    ];
  }

  if (kv && result.length > 0) {
    try {
      await kv.put(kvKey, JSON.stringify(result), {
        expirationTtl: KV_QUOTES_TTL_SEC,
      });
    } catch {
      // best-effort
    }
  }
  return result;
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
