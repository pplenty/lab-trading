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
  getCryptoByBinancePair,
  getCryptoBySymbol,
} from "@/lib/symbols/registry";

// Binance Public API 어댑터 (ADR-0005).
// 무인증 fetch. Cloudflare Workers 호환. USDT 페어 기본.
//
// 사용 엔드포인트:
//   - GET /api/v3/klines     일봉 OHLCV (max 1000 per call — 1차는 단일 호출, 페이지네이션은 후속)
//   - GET /api/v3/ticker/24hr 24h 시세 (단일 / batch 둘 다 지원)
//
// 심볼 매핑: 사이트 `crypto:btc` ↔ Binance `BTCUSDT` (registry 의 binancePair).
// 사이트 currency 표기: `USDT`.

const BASE_URL = "https://api.binance.com";
export const BINANCE_SOURCE = "binance";

// Binance kline row: [openTime(ms), open, high, low, close, volume, closeTime, ...]
type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type BinanceTicker24h = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  closeTime: number;
};

const TIMEFRAME_TO_INTERVAL: Record<Timeframe, string> = {
  "1d": "1d",
  "1w": "1w",
  "1mo": "1M",
};

/** Binance kline raw → 공통 Candle. unix ms → unix sec. */
export function normalizeBinanceKline(row: BinanceKlineRow): Candle {
  return {
    t: Math.floor(row[0] / 1000),
    o: parseFloat(row[1]),
    h: parseFloat(row[2]),
    l: parseFloat(row[3]),
    c: parseFloat(row[4]),
    v: parseFloat(row[5]),
  };
}

/** Binance 24hr ticker raw → 공통 Quote. priceChangePercent 는 이미 % 단위 (-3.5). */
export function normalizeBinanceTicker(
  raw: BinanceTicker24h,
  symbol: Symbol
): Quote {
  return {
    symbol,
    class: "crypto",
    price: parseFloat(raw.lastPrice),
    currency: "USDT",
    changePct24h: parseFloat(raw.priceChangePercent),
    changeAbs24h: parseFloat(raw.priceChange),
    volume24h: parseFloat(raw.quoteVolume),
    high24h: parseFloat(raw.highPrice),
    low24h: parseFloat(raw.lowPrice),
    updatedAt: new Date(raw.closeTime).toISOString(),
    source: BINANCE_SOURCE,
  };
}

function registryEntry(symbol: Symbol) {
  const entry = getCryptoBySymbol(symbol);
  if (!entry || !entry.binancePair) {
    throw new Error(`binance: unknown symbol ${symbol}`);
  }
  return entry;
}

function entryToAsset(entry: ReturnType<typeof getCryptoBySymbol>): Asset {
  if (!entry) throw new Error("binance: null registry entry");
  return {
    class: "crypto",
    symbol: entry.symbol,
    name: entry.name,
    nameKo: entry.nameKo,
    ticker: entry.symbol.toUpperCase(),
    currency: "USDT",
    cgId: entry.cgId,
  };
}

export const binanceAdapter: DataAdapter = {
  id: BINANCE_SOURCE,
  classes: ["crypto"],

  async listAssets(opts?: ListAssetsOpts): Promise<Asset[]> {
    const entries = cryptoRegistry.filter((e) => e.binancePair);
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? entries.length;
    return entries.slice(offset, offset + limit).map(entryToAsset);
  },

  async getAsset(symbol: Symbol): Promise<Asset | null> {
    const entry = getCryptoBySymbol(symbol);
    if (!entry || !entry.binancePair) return null;
    return entryToAsset(entry);
  },

  async getQuote(symbol: Symbol): Promise<Quote> {
    const entry = registryEntry(symbol);
    const url = `${BASE_URL}/api/v3/ticker/24hr?symbol=${entry.binancePair}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`binance.getQuote ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as BinanceTicker24h;
    return normalizeBinanceTicker(raw, symbol);
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    // 등록된 모든 USDT 페어를 batch ticker 로. opts.limit 은 registry 슬라이스로 처리.
    const entries = cryptoRegistry.filter((e) => e.binancePair);
    const limited = opts?.limit ? entries.slice(0, opts.limit) : entries;
    const pairs = limited.map((e) => e.binancePair);
    const symbolsParam = encodeURIComponent(JSON.stringify(pairs));
    const url = `${BASE_URL}/api/v3/ticker/24hr?symbols=${symbolsParam}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`binance.listQuotes: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as BinanceTicker24h[];
    const out: Quote[] = [];
    for (const t of raw) {
      const entry = getCryptoByBinancePair(t.symbol);
      if (!entry) continue;
      out.push(normalizeBinanceTicker(t, entry.symbol));
    }
    return out;
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    const entry = registryEntry(symbol);
    const interval = TIMEFRAME_TO_INTERVAL[opts.timeframe];
    if (!interval) throw new Error(`binance: unsupported timeframe ${opts.timeframe}`);

    const params = new URLSearchParams({
      symbol: entry.binancePair,
      interval,
      limit: String(Math.min(opts.limit ?? 1000, 1000)),
    });
    if (opts.from !== undefined) params.set("startTime", String(opts.from * 1000));
    if (opts.to !== undefined) params.set("endTime", String(opts.to * 1000));

    const url = `${BASE_URL}/api/v3/klines?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`binance.getCandles ${symbol}: HTTP ${res.status}`);
    }
    const raw = (await res.json()) as BinanceKlineRow[];
    return {
      symbol,
      class: "crypto",
      currency: "USDT",
      timeframe: opts.timeframe,
      candles: raw.map(normalizeBinanceKline),
      source: BINANCE_SOURCE,
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
