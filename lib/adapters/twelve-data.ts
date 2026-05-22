import {fetchWithTimeout} from "./_fetch";
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
import {usRegistry, getUsBySymbol} from "@/lib/symbols/registry";

// Twelve Data 어댑터 (ADR-0006).
// 키 자동 분기:
//   - process.env.TWELVE_DATA_API_KEY 가 set 이면 실제 API 호출
//   - 미설정 시 deterministic GBM 더미 데이터 (개발 / 시연 / 무키 환경 대응)
// 더미 모드 source 라벨은 "twelve-data (demo)" — 페이지 footer 에 명시.
//
// 더미 모드의 안정성: 같은 symbol 은 같은 가격 시퀀스 (LCG seed = stringHash(symbol)).
// 가격 단위 USD. 환율 변환 (Phase 1.5+ ADR-0024) 은 별도.

const BASE_URL = "https://api.twelvedata.com";
export const TWELVE_DATA_SOURCE = "twelve-data";
export const TWELVE_DATA_DEMO_SOURCE = "twelve-data (demo)";

function isDemoMode(): boolean {
  if (typeof process === "undefined") return true;
  const key = process.env.TWELVE_DATA_API_KEY;
  return !key || key.length === 0;
}

/** Twelve Data 의 실패 응답 — HTTP 200 + body 안 status:"error" 형식. */
type TwelveFailure = {status: "error"; code?: number; message?: string};

/**
 * Twelve Data 모든 endpoint 공용 호출 helper.
 * 두 실패 채널 모두 throw — caller catch + fallback 트리거:
 *   1) HTTP 비-200
 *   2) HTTP 200 + body `{status:"error"}` (credit 한도 / 분당 8 req / 인증 실패 등)
 *
 * 새 endpoint 추가 시 이 helper 만 사용하면 회귀 안전 ([[Discriminated Union API Error Response]]).
 */
async function callTwelve<T>(
  endpoint: string,
  params: URLSearchParams,
  label: string
): Promise<T> {
  params.set("apikey", process.env.TWELVE_DATA_API_KEY!);
  const res = await fetchWithTimeout(`${BASE_URL}${endpoint}?${params}`);
  if (!res.ok) {
    throw new Error(`twelve-data.${label}: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as T | TwelveFailure;
  if (typeof raw === "object" && raw !== null && "status" in raw && raw.status === "error") {
    const e = raw as TwelveFailure;
    throw new Error(
      `twelve-data.${label}: code=${e.code ?? "?"} ${e.message ?? "error"}`
    );
  }
  return raw as T;
}

/** Twelve Data /quote 응답. */
type TwelveQuote = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  close: string;
  change: string;
  percent_change: string;
  volume: string;
  high: string;
  low: string;
  timestamp: number;
};

/** Twelve Data /time_series 응답. */
type TwelveTimeSeries = {
  meta: {symbol: string; interval: string; currency: string};
  values: Array<{
    datetime: string; // "2026-05-14"
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  }>;
};

// ──────────────────────────────────────────────────────────────────────────
// 더미 GBM helpers

function stringHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const DAY_SEC = 86400;

/** GBM 더미 candles — 결정론적, 같은 symbol 은 같은 시퀀스. */
function dummyCandles(symbol: string, basePrice: number, days: number): Candle[] {
  const rand = lcg(stringHash(`${symbol}-candles`));
  const mu = 0.0004; // 0.04%/day drift
  const sigma = 0.022; // 2.2% daily volatility (미장 평균 근처)

  const candles: Candle[] = [];
  let p = basePrice;
  // 기준 시각 — 현재 UTC 자정 (deterministic per day).
  const nowDay = Math.floor(Date.now() / 1000 / DAY_SEC) * DAY_SEC;

  for (let i = days - 1; i >= 0; i--) {
    const z = gaussian(rand);
    const open = p;
    p = p * Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
    const close = p;
    const high = Math.max(open, close) * (1 + Math.abs(gaussian(rand)) * 0.004);
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rand)) * 0.004);
    const v = 1_000_000 * (0.5 + rand() * 2);
    candles.push({
      t: nowDay - i * DAY_SEC,
      o: round2(open),
      h: round2(high),
      l: round2(low),
      c: round2(close),
      v: Math.round(v),
    });
  }
  return candles;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dummyQuote(symbol: Symbol): Quote {
  const entry = getUsBySymbol(symbol);
  if (!entry) throw new Error(`twelve-data: unknown symbol ${symbol}`);
  const candles = dummyCandles(symbol, entry.basePrice, 2);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const changeAbs = last.c - prev.c;
  const changePct = (changeAbs / prev.c) * 100;
  return {
    symbol,
    class: "us",
    price: last.c,
    currency: "USD",
    changePct24h: changePct,
    changeAbs24h: round2(changeAbs),
    volume24h: last.v,
    high24h: last.h,
    low24h: last.l,
    updatedAt: new Date(last.t * 1000).toISOString(),
    source: TWELVE_DATA_DEMO_SOURCE,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 실제 API normalize

export function normalizeTwelveQuote(raw: TwelveQuote, symbol: Symbol): Quote {
  return {
    symbol,
    class: "us",
    price: parseFloat(raw.close),
    currency: raw.currency || "USD",
    changePct24h: parseFloat(raw.percent_change),
    changeAbs24h: parseFloat(raw.change),
    volume24h: parseFloat(raw.volume),
    high24h: parseFloat(raw.high),
    low24h: parseFloat(raw.low),
    updatedAt: new Date(raw.timestamp * 1000).toISOString(),
    source: TWELVE_DATA_SOURCE,
  };
}

export function normalizeTwelveCandle(
  row: TwelveTimeSeries["values"][number]
): Candle {
  // datetime 은 "YYYY-MM-DD" — UTC 자정 기준 unix sec.
  return {
    t: Math.floor(Date.parse(`${row.datetime}T00:00:00Z`) / 1000),
    o: parseFloat(row.open),
    h: parseFloat(row.high),
    l: parseFloat(row.low),
    c: parseFloat(row.close),
    v: parseFloat(row.volume),
  };
}

function entryToAsset(entry: ReturnType<typeof getUsBySymbol>): Asset {
  if (!entry) throw new Error("twelve-data: null registry entry");
  return {
    class: "us",
    symbol: entry.symbol,
    name: entry.name,
    nameKo: entry.nameKo,
    ticker: entry.ticker,
    currency: "USD",
    market: entry.market,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Adapter

export const twelveDataAdapter: DataAdapter = {
  get id() {
    return isDemoMode() ? TWELVE_DATA_DEMO_SOURCE : TWELVE_DATA_SOURCE;
  },
  classes: ["us"],

  async listAssets(opts?: ListAssetsOpts): Promise<Asset[]> {
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? usRegistry.length;
    return usRegistry.slice(offset, offset + limit).map(entryToAsset);
  },

  async getAsset(symbol: Symbol): Promise<Asset | null> {
    const entry = getUsBySymbol(symbol);
    if (!entry) return null;
    return entryToAsset(entry);
  },

  async getQuote(symbol: Symbol): Promise<Quote> {
    const entry = getUsBySymbol(symbol);
    if (!entry) throw new Error(`twelve-data: unknown symbol ${symbol}`);

    if (isDemoMode()) return dummyQuote(symbol);

    const raw = await callTwelve<TwelveQuote>(
      "/quote",
      new URLSearchParams({symbol: entry.ticker}),
      `getQuote ${symbol}`
    );
    return normalizeTwelveQuote(raw, symbol);
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    if (isDemoMode()) {
      const entries = opts?.limit
        ? usRegistry.slice(0, opts.limit)
        : usRegistry;
      return entries.map((e) => dummyQuote(e.symbol));
    }
    // 실제 모드는 batch — Twelve Data 의 `/quote?symbol=AAPL,MSFT,...` 지원.
    const entries = opts?.limit ? usRegistry.slice(0, opts.limit) : usRegistry;
    const symbols = entries.map((e) => e.ticker).join(",");
    // 단일 ticker 는 객체, 다중은 {AAPL: {...}, ...} map — discriminated 처리.
    const raw = await callTwelve<Record<string, TwelveQuote> | TwelveQuote>(
      "/quote",
      new URLSearchParams({symbol: symbols}),
      "listQuotes"
    );
    const out: Quote[] = [];
    if ("symbol" in raw && typeof raw.symbol === "string") {
      const single = raw as TwelveQuote;
      const e = usRegistry.find((x) => x.ticker === single.symbol);
      if (e) out.push(normalizeTwelveQuote(single, e.symbol));
    } else {
      const map = raw as Record<string, TwelveQuote>;
      for (const [ticker, q] of Object.entries(map)) {
        const e = usRegistry.find((x) => x.ticker === ticker);
        if (e) out.push(normalizeTwelveQuote(q, e.symbol));
      }
    }
    return out;
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    const entry = getUsBySymbol(symbol);
    if (!entry) throw new Error(`twelve-data: unknown symbol ${symbol}`);
    if (opts.timeframe !== "1d") {
      throw new Error(`twelve-data: only 1d timeframe supported (got ${opts.timeframe})`);
    }
    const limit = Math.min(opts.limit ?? 200, 5000);

    if (isDemoMode()) {
      const all = dummyCandles(symbol, entry.basePrice, limit);
      const filtered = all
        .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
        .filter((c) => (opts.to === undefined ? true : c.t < opts.to));
      return {
        symbol,
        class: "us",
        currency: "USD",
        timeframe: "1d",
        candles: filtered,
        source: TWELVE_DATA_DEMO_SOURCE,
        cachedAt: new Date().toISOString(),
      };
    }

    const ts = await callTwelve<TwelveTimeSeries>(
      "/time_series",
      new URLSearchParams({
        symbol: entry.ticker,
        interval: "1day",
        outputsize: String(limit),
      }),
      `getCandles ${symbol}`
    );
    // Twelve Data 는 최신 → 과거 순. 시간순 정렬 후 반환.
    const candles = (ts.values ?? [])
      .map(normalizeTwelveCandle)
      .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
      .filter((c) => (opts.to === undefined ? true : c.t < opts.to))
      .sort((a, b) => a.t - b.t);
    return {
      symbol,
      class: "us",
      currency: ts.meta?.currency ?? "USD",
      timeframe: "1d",
      candles,
      source: TWELVE_DATA_SOURCE,
      cachedAt: new Date().toISOString(),
    };
  },

  async rankings(kind: RankingKind, opts?: ListQuotesOpts): Promise<Quote[]> {
    // 1차는 listQuotes + sort (Twelve Data 의 /market_movers 는 키 발급 후 활성).
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
