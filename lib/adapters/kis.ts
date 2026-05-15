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
//   - KIS_APP_KEY + KIS_APP_SECRET 모두 set → 라이브 (OAuth 토큰 + REST 호출)
//   - 미설정 시 deterministic GBM 더미 (호가 단위 정수 quantize)
// OAuth 토큰: in-memory 캐시 (각 Worker instance 별도). Workers KV fan-in 은 Phase 1.5 후속.
//
// 도메인:
//   - KIS_ENV=vts (모의, 디폴트): https://openapivts.koreainvestment.com:29443
//   - KIS_ENV=prod (실계좌):       https://openapi.koreainvestment.com:9443

export const KIS_SOURCE = "kis";
export const KIS_DEMO_SOURCE = "kis (demo)";

function isDemoMode(): boolean {
  if (typeof process === "undefined") return true;
  const key = process.env.KIS_APP_KEY;
  const secret = process.env.KIS_APP_SECRET;
  return !key || !secret;
}

function kisBaseUrl(): string {
  const env =
    typeof process !== "undefined" ? process.env.KIS_ENV : undefined;
  return env === "prod"
    ? "https://openapi.koreainvestment.com:9443"
    : "https://openapivts.koreainvestment.com:29443";
}

const DAY_SEC = 86400;

// ──────────────────────────────────────────────────────────────────────────
// OAuth 토큰 in-memory 캐시 (module-level)
// ──────────────────────────────────────────────────────────────────────────

let cachedToken: {token: string; expiresAtMs: number} | null = null;

async function getAccessToken(): Promise<string> {
  // 만료 60초 전엔 미리 재발급
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${kisBaseUrl()}/oauth2/tokenP`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kis.oauth: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

function kisAuthHeaders(token: string, trId: string): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
    authorization: `Bearer ${token}`,
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    tr_id: trId,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 라이브 normalize
// ──────────────────────────────────────────────────────────────────────────

type KisQuoteOutput = {
  stck_prpr: string;       // 현재가
  prdy_vrss: string;       // 전일 대비
  prdy_ctrt: string;       // 전일 대비율 (%)
  acml_vol: string;        // 누적 거래량
  acml_tr_pbmn: string;    // 누적 거래대금
  stck_hgpr: string;       // 최고가
  stck_lwpr: string;       // 최저가
  stck_oprc?: string;      // 시가
};

export function normalizeKisQuote(
  o: KisQuoteOutput,
  symbol: Symbol
): Quote {
  return {
    symbol,
    class: "kr",
    price: parseInt(o.stck_prpr, 10),
    currency: "KRW",
    changePct24h: parseFloat(o.prdy_ctrt),
    changeAbs24h: parseInt(o.prdy_vrss, 10),
    volume24h: parseFloat(o.acml_tr_pbmn ?? o.acml_vol),
    high24h: parseInt(o.stck_hgpr, 10),
    low24h: parseInt(o.stck_lwpr, 10),
    updatedAt: new Date().toISOString(),
    source: KIS_SOURCE,
  };
}

type KisCandleRow = {
  stck_bsop_date: string;  // "YYYYMMDD"
  stck_oprc: string;
  stck_hgpr: string;
  stck_lwpr: string;
  stck_clpr: string;
  acml_vol: string;
};

export function normalizeKisCandle(row: KisCandleRow): Candle {
  const d = row.stck_bsop_date; // "20260515"
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`;
  return {
    t: Math.floor(Date.parse(iso) / 1000),
    o: parseInt(row.stck_oprc, 10),
    h: parseInt(row.stck_hgpr, 10),
    l: parseInt(row.stck_lwpr, 10),
    c: parseInt(row.stck_clpr, 10),
    v: parseInt(row.acml_vol, 10),
  };
}

async function liveGetQuote(symbol: Symbol): Promise<Quote> {
  const entry = getKrBySymbol(symbol);
  if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
  const token = await getAccessToken();
  const url = `${kisBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${entry.ticker}`;
  const res = await fetch(url, {
    headers: kisAuthHeaders(token, "FHKST01010100"),
  });
  if (!res.ok) {
    throw new Error(`kis.getQuote ${symbol}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {rt_cd: string; output: KisQuoteOutput};
  if (data.rt_cd !== "0") {
    throw new Error(`kis.getQuote ${symbol}: rt_cd=${data.rt_cd}`);
  }
  return normalizeKisQuote(data.output, symbol);
}

async function liveGetCandles(
  symbol: Symbol,
  opts: GetCandlesOpts
): Promise<CandleSeries> {
  const entry = getKrBySymbol(symbol);
  if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
  const token = await getAccessToken();

  // inquire-daily-itemchartprice 는 최대 100건/호출. 200봉이면 2회 호출 (현재→과거 100, 다시 그 이전 100).
  // 1차 단순화: 단일 호출 (최근 100봉). 페이지네이션은 Phase 1.5 cron backfill 에서.
  const today = new Date();
  const formatDate = (d: Date) =>
    d.toISOString().slice(0, 10).replace(/-/g, "");
  const endDate =
    opts.to !== undefined ? new Date(opts.to * 1000) : today;
  const startDate =
    opts.from !== undefined
      ? new Date(opts.from * 1000)
      : new Date(endDate.getTime() - 100 * DAY_SEC * 1000);

  const params = new URLSearchParams({
    fid_cond_mrkt_div_code: "J",
    fid_input_iscd: entry.ticker,
    fid_input_date_1: formatDate(startDate),
    fid_input_date_2: formatDate(endDate),
    fid_period_div_code: "D",
    fid_org_adj_prc: "0", // 수정주가 미적용 (Phase 2 에 옵션화)
  });
  const url = `${kisBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`;
  const res = await fetch(url, {
    headers: kisAuthHeaders(token, "FHKST03010100"),
  });
  if (!res.ok) {
    throw new Error(`kis.getCandles ${symbol}: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    rt_cd: string;
    output2: KisCandleRow[];
  };
  if (data.rt_cd !== "0") {
    throw new Error(`kis.getCandles ${symbol}: rt_cd=${data.rt_cd}`);
  }
  // 응답은 최신 → 과거. 시간순 정렬.
  const candles = (data.output2 ?? [])
    .map(normalizeKisCandle)
    .filter((c) => (opts.from === undefined ? true : c.t >= opts.from))
    .filter((c) => (opts.to === undefined ? true : c.t < opts.to))
    .sort((a, b) => a.t - b.t);

  return {
    symbol,
    class: "kr",
    currency: "KRW",
    timeframe: "1d",
    candles,
    source: KIS_SOURCE,
    cachedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 더미 GBM (키 미발급 시 fallback)
// ──────────────────────────────────────────────────────────────────────────

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

/** KRX 호가 단위 quantize — 1차는 가격대별 round-to. */
function quantize(price: number): number {
  if (price < 1000) return Math.round(price);
  if (price < 10000) return Math.round(price / 5) * 5;
  if (price < 50000) return Math.round(price / 10) * 10;
  if (price < 100000) return Math.round(price / 50) * 50;
  if (price < 500000) return Math.round(price / 100) * 100;
  return Math.round(price / 500) * 500;
}

function dummyCandles(symbol: string, basePrice: number, days: number): Candle[] {
  const rand = lcg(stringHash(`${symbol}-kr-candles`));
  const mu = 0.0002;
  const sigma = 0.018;
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

// ──────────────────────────────────────────────────────────────────────────
// Adapter
// ──────────────────────────────────────────────────────────────────────────

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
    if (isDemoMode()) return dummyQuote(symbol);
    return liveGetQuote(symbol);
  },

  async listQuotes(opts?: ListQuotesOpts): Promise<Quote[]> {
    const entries = opts?.limit ? krRegistry.slice(0, opts.limit) : krRegistry;
    if (isDemoMode()) return entries.map((e) => dummyQuote(e.symbol));
    // 라이브: 종목별 개별 호출 — KIS rate limit 10 req/s 라 12 종목 1초 내. 후속 PR 에 배치 endpoint 검토.
    const results = await Promise.allSettled(
      entries.map((e) => liveGetQuote(e.symbol))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
      .map((r) => r.value);
  },

  async getCandles(symbol: Symbol, opts: GetCandlesOpts): Promise<CandleSeries> {
    const entry = getKrBySymbol(symbol);
    if (!entry) throw new Error(`kis: unknown symbol ${symbol}`);
    if (opts.timeframe !== "1d") {
      throw new Error(`kis: only 1d timeframe supported (got ${opts.timeframe})`);
    }
    if (isDemoMode()) {
      const limit = Math.min(opts.limit ?? 200, 200);
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
    return liveGetCandles(symbol, opts);
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
