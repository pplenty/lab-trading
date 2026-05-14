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
import {krRegistry, getKrBySymbol} from "@/lib/symbols/registry";

// KIS (한국투자증권) Open API 어댑터 (ADR-0007).
// 키 자동 분기:
//   - KIS_APP_KEY + KIS_APP_SECRET 모두 set → 실제 API (OAuth 토큰 fan-in)
//   - 미설정 시 deterministic GBM 더미 (한국 주식 변동성에 맞춘 sigma).
// 1차는 더미 모드만 활성. 실제 KIS API 호출은 Phase 1.5 (사용자 계좌 개설 + 키 발급 후).
// OAuth 토큰 캐시 (Workers KV) 도 Phase 1.5 작업.

export const KIS_SOURCE = "kis";
export const KIS_DEMO_SOURCE = "kis (demo)";

function isDemoMode(): boolean {
  if (typeof process === "undefined") return true;
  const key = process.env.KIS_APP_KEY;
  const secret = process.env.KIS_APP_SECRET;
  return !key || !secret;
}

const DAY_SEC = 86400;

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

/** KRX 호가 단위 quantize — 1차 출시는 round-to-100 단순화 (실제 KRX 단위는 가격대별 다름). */
function quantize(price: number): number {
  if (price < 1000) return Math.round(price);
  if (price < 10000) return Math.round(price / 5) * 5;
  if (price < 50000) return Math.round(price / 10) * 10;
  if (price < 100000) return Math.round(price / 50) * 50;
  if (price < 500000) return Math.round(price / 100) * 100;
  return Math.round(price / 500) * 500;
}

/** KR 일봉 GBM. 한국 주식 평균 변동성 (sigma ~ 1.8%) 기반. */
function dummyCandles(symbol: string, basePrice: number, days: number): Candle[] {
  const rand = lcg(stringHash(`${symbol}-kr-candles`));
  const mu = 0.0002; // 0.02%/day drift
  const sigma = 0.018; // 1.8% daily volatility

  const candles: Candle[] = [];
  let p = basePrice;
  const nowDay = Math.floor(Date.now() / 1000 / DAY_SEC) * DAY_SEC;

  for (let i = days - 1; i >= 0; i--) {
    const z = gaussian(rand);
    const open = p;
    p = p * Math.exp(mu - 0.5 * sigma * sigma + sigma * z);
    const close = p;
    const high = Math.max(open, close) * (1 + Math.abs(gaussian(rand)) * 0.004);
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rand)) * 0.004);
    const v = 100_000 + 1_000_000 * rand();
    candles.push({
      t: nowDay - i * DAY_SEC,
      o: quantize(open),
      h: quantize(high),
      l: quantize(low),
      c: quantize(close),
      v: Math.round(v),
    });
  }
  return candles;
}

function dummyQuote(symbol: Symbol): Quote {
  const entry = getKrBySymbol(symbol);
  if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
  const candles = dummyCandles(symbol, entry.basePrice, 2);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const changeAbs = last.c - prev.c;
  const changePct = (changeAbs / prev.c) * 100;
  return {
    symbol,
    class: "kr",
    price: last.c,
    currency: "KRW",
    changePct24h: changePct,
    changeAbs24h: changeAbs,
    volume24h: last.v,
    high24h: last.h,
    low24h: last.l,
    updatedAt: new Date(last.t * 1000).toISOString(),
    source: KIS_DEMO_SOURCE,
  };
}

function entryToAsset(entry: ReturnType<typeof getKrBySymbol>): Asset {
  if (!entry) throw new Error("kis: null registry entry");
  return {
    class: "kr",
    symbol: entry.symbol,
    name: entry.name,
    nameKo: entry.nameKo,
    ticker: entry.ticker,
    currency: "KRW",
    market: entry.market,
  };
}

export const kisAdapter: DataAdapter = {
  get id() {
    return isDemoMode() ? KIS_DEMO_SOURCE : KIS_SOURCE;
  },
  classes: ["kr"],

  async listAssets(opts?: ListAssetsOpts): Promise<Asset[]> {
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? krRegistry.length;
    return krRegistry.slice(offset, offset + limit).map(entryToAsset);
  },

  async getAsset(symbol: Symbol): Promise<Asset | null> {
    const entry = getKrBySymbol(symbol);
    if (!entry) return null;
    return entryToAsset(entry);
  },

  async getQuote(symbol: Symbol): Promise<Quote> {
    const entry = getKrBySymbol(symbol);
    if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
    if (isDemoMode()) return dummyQuote(symbol);
    // Phase 1.5 — 실제 KIS REST 호출. OAuth 토큰 (Workers KV fan-in) + /uapi/domestic-stock/v1/quotations/inquire-price
    throw new Error("kis: live mode not yet implemented (Phase 1.5)");
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    const entries = opts?.limit ? krRegistry.slice(0, opts.limit) : krRegistry;
    if (isDemoMode()) return entries.map((e) => dummyQuote(e.symbol));
    throw new Error("kis: live mode not yet implemented (Phase 1.5)");
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    const entry = getKrBySymbol(symbol);
    if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
    if (opts.timeframe !== "1d") {
      throw new Error(`kis: only 1d timeframe supported (got ${opts.timeframe})`);
    }
    const limit = Math.min(opts.limit ?? 200, 200);

    if (isDemoMode()) {
      const all = dummyCandles(symbol, entry.basePrice, limit);
      const filtered = all
        .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
        .filter((c) => (opts.to === undefined ? true : c.t < opts.to));
      return {
        symbol,
        class: "kr",
        currency: "KRW",
        timeframe: "1d",
        candles: filtered,
        source: KIS_DEMO_SOURCE,
        cachedAt: new Date().toISOString(),
      };
    }
    throw new Error("kis: live mode not yet implemented (Phase 1.5)");
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
