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
  Timeframe,
} from "@/lib/types";
import type {DataAdapter} from "./types";
import {
  cryptoRegistry,
  getCryptoBySymbol,
  getCryptoByUpbitMarket,
} from "@/lib/symbols/registry";

// Upbit Public API 어댑터 (ADR-0005).
// 무인증 fetch. KRW 페어 기본 — 한국 사용자 디폴트 표시.
//
// 사용 엔드포인트:
//   - GET /v1/candles/days       일봉 (max 200 per call — 1차는 단일 호출)
//   - GET /v1/ticker?markets=    시세 (단일 / batch comma-separated)
//
// 심볼 매핑: 사이트 `crypto:btc` ↔ Upbit `KRW-BTC` (registry 의 upbitMarket).
// 사이트 currency 표기: `KRW`.

const BASE_URL = "https://api.upbit.com";
export const UPBIT_SOURCE = "upbit";

type UpbitTicker = {
  market: string;
  trade_price: number;
  prev_closing_price: number;
  change: "RISE" | "FALL" | "EVEN";
  signed_change_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
  high_price: number;
  low_price: number;
  trade_timestamp: number; // ms
};

type UpbitDayCandle = {
  market: string;
  candle_date_time_utc: string; // "2026-05-14T00:00:00"
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number; // 종가
  candle_acc_trade_volume: number;
  timestamp: number;
};

/** Upbit ticker raw → 공통 Quote. signed_change_rate 는 비율 (0.012 = 1.2%). */
export function normalizeUpbitTicker(raw: UpbitTicker, symbol: Symbol): Quote {
  return {
    symbol,
    class: "crypto",
    price: raw.trade_price,
    currency: "KRW",
    changePct24h: raw.signed_change_rate * 100,
    changeAbs24h: raw.signed_change_price,
    volume24h: raw.acc_trade_price_24h,
    high24h: raw.high_price,
    low24h: raw.low_price,
    updatedAt: new Date(raw.trade_timestamp).toISOString(),
    source: UPBIT_SOURCE,
  };
}

/** Upbit 일봉 raw → 공통 Candle. candle_date_time_utc 는 ISO 문자열 (Z 없음). */
export function normalizeUpbitCandle(raw: UpbitDayCandle): Candle {
  const ts = Date.parse(raw.candle_date_time_utc + "Z");
  return {
    t: Math.floor(ts / 1000),
    o: raw.opening_price,
    h: raw.high_price,
    l: raw.low_price,
    c: raw.trade_price,
    v: raw.candle_acc_trade_volume,
  };
}

function registryEntry(symbol: Symbol) {
  const entry = getCryptoBySymbol(symbol);
  if (!entry || !entry.upbitMarket) {
    throw new Error(`upbit: unknown symbol ${symbol}`);
  }
  return entry;
}

function entryToAsset(
  entry: ReturnType<typeof getCryptoBySymbol>
): Asset {
  if (!entry) throw new Error("upbit: null registry entry");
  return {
    class: "crypto",
    symbol: entry.symbol,
    name: entry.name,
    nameKo: entry.nameKo,
    ticker: entry.symbol.toUpperCase(),
    currency: "KRW",
    market: "KRW",
    cgId: entry.cgId,
  };
}

export const upbitAdapter: DataAdapter = {
  id: UPBIT_SOURCE,
  classes: ["crypto"],

  async listAssets(opts?: ListAssetsOpts): Promise<Asset[]> {
    const entries = cryptoRegistry.filter((e) => e.upbitMarket);
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? entries.length;
    return entries.slice(offset, offset + limit).map(entryToAsset);
  },

  async getAsset(symbol: Symbol): Promise<Asset | null> {
    const entry = getCryptoBySymbol(symbol);
    if (!entry || !entry.upbitMarket) return null;
    return entryToAsset(entry);
  },

  async getQuote(symbol: Symbol): Promise<Quote> {
    const entry = registryEntry(symbol);
    const url = `${BASE_URL}/v1/ticker?markets=${entry.upbitMarket}`;
    const res = await fetch(url, {headers: {Accept: "application/json"}});
    if (!res.ok) {
      throw new Error(`upbit.getQuote ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as UpbitTicker[];
    if (raw.length === 0) {
      throw new Error(`upbit.getQuote ${symbol}: empty response`);
    }
    return normalizeUpbitTicker(raw[0], symbol);
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    const entries = cryptoRegistry.filter((e) => e.upbitMarket);
    const limited = opts?.limit ? entries.slice(0, opts.limit) : entries;
    const markets = limited.map((e) => e.upbitMarket).join(",");
    const url = `${BASE_URL}/v1/ticker?markets=${markets}`;
    const res = await fetch(url, {headers: {Accept: "application/json"}});
    if (!res.ok) {
      throw new Error(`upbit.listQuotes: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as UpbitTicker[];
    const out: Quote[] = [];
    for (const t of raw) {
      const entry = getCryptoByUpbitMarket(t.market);
      if (!entry) continue;
      out.push(normalizeUpbitTicker(t, entry.symbol));
    }
    return out;
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    const entry = registryEntry(symbol);
    if (opts.timeframe !== "1d") {
      throw new Error(`upbit: only 1d timeframe supported (got ${opts.timeframe})`);
    }
    const params = new URLSearchParams({
      market: entry.upbitMarket,
      count: String(Math.min(opts.limit ?? 200, 200)),
    });
    if (opts.to !== undefined) {
      params.set("to", new Date(opts.to * 1000).toISOString());
    }
    const url = `${BASE_URL}/v1/candles/days?${params}`;
    const res = await fetch(url, {headers: {Accept: "application/json"}});
    if (!res.ok) {
      throw new Error(`upbit.getCandles ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as UpbitDayCandle[];
    // Upbit 응답은 최신 → 과거 순. 백테스트·차트는 시간순(오래된게 앞)이 자연.
    const candles = raw
      .map(normalizeUpbitCandle)
      .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
      .sort((a, b) => a.t - b.t);
    return {
      symbol,
      class: "crypto",
      currency: "KRW",
      timeframe: opts.timeframe,
      candles,
      source: UPBIT_SOURCE,
      cachedAt: new Date().toISOString(),
    };
  },

  async rankings(
    kind: RankingKind,
    opts?: ListQuotesOpts
  ): Promise<Quote[]> {
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
