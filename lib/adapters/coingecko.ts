import type {
  Asset,
  Candle,
  CandleSeries,
  GetCandlesOpts,
  ListAssetsOpts,
  ListQuotesOpts,
  Quote,
  RankingKind,
  Symbol,
} from "@/lib/types";
import type {DataAdapter} from "./types";
import {cryptoRegistry, getCryptoBySymbol, getCryptoByCgId} from "@/lib/symbols/registry";

// CoinGecko 어댑터 (ADR-0005).
// 무료 Demo API — 키 없이도 호출 가능하지만 rate limit 매우 낮음 (분당 10-30회).
// 키 있으면 `x-cg-demo-api-key` 헤더 + 분당 30회.
// 역할: 글로벌 시가총액 / 랭킹 / 로고 / USD 가격 보강 (메인 시세는 Upbit KRW).

const BASE_URL = "https://api.coingecko.com/api/v3";
export const COINGECKO_SOURCE = "coingecko";

function apiHeaders(): HeadersInit {
  const key =
    typeof process !== "undefined" ? process.env.COINGECKO_API_KEY : undefined;
  if (!key) return {Accept: "application/json"};
  return {Accept: "application/json", "x-cg-demo-api-key": key};
}

type CoinGeckoMarketRow = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number | null;
  low_24h: number | null;
  last_updated: string;
};

/** CoinGecko /coins/markets row → 공통 Quote (USD). */
export function normalizeCoinGeckoMarket(
  row: CoinGeckoMarketRow,
  symbol: Symbol
): Quote {
  return {
    symbol,
    class: "crypto",
    price: row.current_price,
    currency: "USD",
    changePct24h: row.price_change_percentage_24h ?? 0,
    changeAbs24h: row.price_change_24h ?? 0,
    volume24h: row.total_volume,
    high24h: row.high_24h ?? undefined,
    low24h: row.low_24h ?? undefined,
    marketCap: row.market_cap,
    rank: row.market_cap_rank,
    updatedAt: row.last_updated,
    source: COINGECKO_SOURCE,
  };
}

function entryToAsset(entry: ReturnType<typeof getCryptoBySymbol>): Asset {
  if (!entry) throw new Error("coingecko: null registry entry");
  return {
    class: "crypto",
    symbol: entry.symbol,
    name: entry.name,
    nameKo: entry.nameKo,
    ticker: entry.symbol.toUpperCase(),
    currency: "USD",
    cgId: entry.cgId,
  };
}

export const coingeckoAdapter: DataAdapter = {
  id: COINGECKO_SOURCE,
  classes: ["crypto"],

  async listAssets(opts?: ListAssetsOpts): Promise<Asset[]> {
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? cryptoRegistry.length;
    return cryptoRegistry.slice(offset, offset + limit).map(entryToAsset);
  },

  async getAsset(symbol: Symbol): Promise<Asset | null> {
    const entry = getCryptoBySymbol(symbol);
    if (!entry) return null;
    return entryToAsset(entry);
  },

  async getQuote(symbol: Symbol): Promise<Quote> {
    const entry = getCryptoBySymbol(symbol);
    if (!entry) throw new Error(`coingecko: unknown symbol ${symbol}`);
    // 단일 ticker 도 /coins/markets?ids= 로 호출 — `/simple/price` 보다 풍부.
    const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${entry.cgId}`;
    const res = await fetch(url, {headers: apiHeaders()});
    if (!res.ok) {
      throw new Error(`coingecko.getQuote ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as CoinGeckoMarketRow[];
    if (raw.length === 0) {
      throw new Error(`coingecko.getQuote ${symbol}: empty response`);
    }
    return normalizeCoinGeckoMarket(raw[0], symbol);
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    const entries = cryptoRegistry;
    const ids = (opts?.limit ? entries.slice(0, opts.limit) : entries)
      .map((e) => e.cgId)
      .join(",");
    const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc`;
    const res = await fetch(url, {headers: apiHeaders()});
    if (!res.ok) {
      throw new Error(`coingecko.listQuotes: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as CoinGeckoMarketRow[];
    const out: Quote[] = [];
    for (const r of raw) {
      const entry = getCryptoByCgId(r.id);
      if (!entry) continue;
      out.push(normalizeCoinGeckoMarket(r, entry.symbol));
    }
    return out;
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    // CoinGecko 의 `/coins/{id}/market_chart` 는 [timestamp, price] 페어 (OHLC 아님).
    // OHLC 는 별도 `/coins/{id}/ohlc` (최대 365일) — 1차는 Binance/Upbit candles 가 메인.
    // 여기선 OHLC endpoint 호출 — open=high=low=close 동일가, volume 0 으로 normalize.
    const entry = getCryptoBySymbol(symbol);
    if (!entry) throw new Error(`coingecko: unknown symbol ${symbol}`);
    if (opts.timeframe !== "1d") {
      throw new Error(`coingecko: only 1d timeframe (got ${opts.timeframe})`);
    }
    const days = Math.min(opts.limit ?? 365, 365);
    const url = `${BASE_URL}/coins/${entry.cgId}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url, {headers: apiHeaders()});
    if (!res.ok) {
      throw new Error(`coingecko.getCandles ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as Array<[number, number, number, number, number]>;
    const candles: Candle[] = raw.map((row) => ({
      t: Math.floor(row[0] / 1000),
      o: row[1],
      h: row[2],
      l: row[3],
      c: row[4],
      v: 0, // CoinGecko OHLC 는 volume 미제공
    }));
    return {
      symbol,
      class: "crypto",
      currency: "USD",
      timeframe: "1d",
      candles: candles
        .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
        .filter((c) => (opts.to === undefined ? true : c.t < opts.to))
        .sort((a, b) => a.t - b.t),
      source: COINGECKO_SOURCE,
      cachedAt: new Date().toISOString(),
    };
  },

  async rankings(kind: RankingKind, opts?: ListQuotesOpts): Promise<Quote[]> {
    const quotes = await this.listQuotes(opts);
    const sorted = [...quotes];
    switch (kind) {
      case "gainers":
        sorted.sort((a, b) => b.changePct24h - a.changePct24h);
        break;
      case "losers":
        sorted.sort((a, b) => a.changePct24h - b.changePct24h);
        break;
      case "volume":
        sorted.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
        break;
    }
    return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
  },
};
