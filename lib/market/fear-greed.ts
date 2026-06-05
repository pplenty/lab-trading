import {fetchWithTimeout} from "@/lib/adapters/_fetch";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import {
  type FearGreedZone,
  ZONE_LABELS_EN,
  ZONE_LABELS_KO,
  zoneFromClassification,
  zoneFromValue,
} from "./gauge";

// 공포·탐욕(Fear & Greed) 지수 데이터 레이어.
//
// 소스:
//   - 코인: CoinMarketCap Fear & Greed 1순위 → 실패 시 alternative.me 폴백.
//       CMC 는 `CMC_API_KEY` 있으면 **공식 Pro API**(X-CMC_PRO_API_KEY, 깨끗한 ToS),
//       없으면 웹사이트 data-api(무키, 비공식·ToS-gray + 브라우저 UA). 키는 CF Worker secret
//       (`wrangler secret put CMC_API_KEY`) + 로컬 `.dev.vars`/`.env.local` — 저장소엔 X.
//       둘 다 0-100 + 분류(5단계), 일 1회 갱신. **출처 표기**(attribution) 위젯에 노출.
//   - 미국: feargreedchart.com (CNN식 자체 산출 5-component 공포·탐욕 합성, 0-100, CORS 개방
//       → Cloudflare Worker 친화). 실패 시 FRED VIXCLS(공공 도메인 VIX 종가)를 0-100 으로
//       밴딩한 프록시로 폴백. (CNN 직접 스크랩은 ToS/418 리스크라 회피. FRED 는 미정부 사이트라
//       CF 데이터센터 IP 를 차단 → 런타임 실패 → feargreedchart 를 1순위로.)
//
// 캐시: KV 7일 보관 + fetchedAt 기준 1h freshness. fetch 실패 시 stale 캐시 반환(stale-while-error).
// 둘 다 일 1회 갱신이라 1h TTL 로 충분. 단일 호스트 → stale 폴백으로 위젯이 절대 비지 않게.

export type FearGreedMarket = "crypto" | "us";

export type FearGreedReading = {
  market: FearGreedMarket;
  /** 0-100 탐욕 점수 (0 = 극단적 공포, 100 = 극단적 탐욕). */
  value: number;
  zone: FearGreedZone;
  labelEn: string;
  labelKo: string;
  /** 출처 표기 (ToS 의무). */
  source: string;
  sourceUrl: string;
  /** 지수 기준 시각 (unix sec, UTC). */
  updatedAt: number;
  /** VIX 등 자체 산출 프록시 여부 — UI 에 "프록시" 라벨. */
  isProxy: boolean;
  /** 보조 표시 (예: "VIX 15.7"). */
  detail?: string;
  /** 직전(전일) 점수 — 추세 화살표용. */
  prev?: number | null;
  /** 1주 전 점수. */
  weekAgo?: number | null;
  /** stale 캐시에서 제공됐는지 (fetch 실패 폴백). */
  stale?: boolean;
};

type CachedReading = FearGreedReading & {fetchedAt: number};

const FRESH_MS = 60 * 60 * 1000; // 1h
const CACHE_TTL_SEC = 7 * 24 * 3600; // 7d KV 보관

function buildReading(
  market: FearGreedMarket,
  value: number,
  zone: FearGreedZone,
  base: Partial<FearGreedReading>
): FearGreedReading {
  return {
    market,
    value,
    zone,
    labelEn: ZONE_LABELS_EN[zone],
    labelKo: ZONE_LABELS_KO[zone],
    source: base.source ?? "",
    sourceUrl: base.sourceUrl ?? "",
    updatedAt: base.updatedAt ?? Math.floor(Date.now() / 1000),
    isProxy: base.isProxy ?? false,
    detail: base.detail,
    prev: base.prev ?? null,
    weekAgo: base.weekAgo ?? null,
  };
}

// ── 코인 1순위: CoinMarketCap ────────────────────────────────────────
// CMC_API_KEY 있으면 공식 Pro API(깨끗한 ToS), 없으면 웹사이트 data-api(무키, 비공식·ToS-gray).
type CmcFngPoint = {score?: number; name?: string; timestamp?: string};

function cmcApiKey(): string | undefined {
  const k = typeof process !== "undefined" ? process.env.CMC_API_KEY : undefined;
  return k && k.length > 0 ? k : undefined;
}

async function fetchCmcFng(): Promise<FearGreedReading> {
  const key = cmcApiKey();
  return key ? fetchCmcProApi(key) : fetchCmcDataApi();
}

// 공식 Pro API (X-CMC_PRO_API_KEY 헤더). Basic(무료) 플랜 OK. /latest 는 현재값만 (전일/주간 X).
async function fetchCmcProApi(key: string): Promise<FearGreedReading> {
  const res = await fetchWithTimeout(
    "https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest",
    {
      timeoutMs: 8000,
      headers: {Accept: "application/json", "X-CMC_PRO_API_KEY": key},
    }
  );
  if (!res.ok) throw new Error(`CMC Pro HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: {value?: number; value_classification?: string; update_time?: string};
  };
  const v = json.data?.value;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error("CMC Pro bad value");
  }
  const value = Math.round(Math.max(0, Math.min(100, v)));
  const zone = zoneFromClassification(json.data?.value_classification ?? "", value);
  const upd = json.data?.update_time
    ? Math.floor(new Date(json.data.update_time).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  return buildReading("crypto", value, zone, {
    source: "CoinMarketCap",
    sourceUrl: "https://coinmarketcap.com/charts/fear-and-greed-index/",
    updatedAt: Number.isFinite(upd) ? upd : Math.floor(Date.now() / 1000),
    isProxy: false,
  });
}

// 폴백/무키: 웹사이트 data-api (비공식). dialConfig 밴드(0-20/20-40/40-60/60-80/80-100)는
// 게이지 5등분과 일치. `name` 분류 신뢰. historicalValues 로 전일/주간 컨텍스트 제공.
async function fetchCmcDataApi(): Promise<FearGreedReading> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 8 * 86400; // 8일 → 전일/주간 컨텍스트 확보
  const url = `https://api.coinmarketcap.com/data-api/v3/fear-greed/chart?start=${start}&end=${now}`;
  const res = await fetchWithTimeout(url, {
    timeoutMs: 8000,
    headers: {
      Accept: "application/json",
      // CMC data-api 는 브라우저류 UA 기대 (UA 없거나 봇류면 차단 가능).
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`CMC HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      historicalValues?: {
        now?: CmcFngPoint;
        yesterday?: CmcFngPoint;
        lastWeek?: CmcFngPoint;
      };
      dataList?: CmcFngPoint[];
    };
  };
  const hv = json.data?.historicalValues;
  const list = json.data?.dataList;
  const latest = hv?.now ?? (list && list.length > 0 ? list[list.length - 1] : undefined);
  const score = latest?.score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    throw new Error("CMC bad score");
  }
  const value = Math.round(Math.max(0, Math.min(100, score)));
  const zone = zoneFromClassification(latest?.name ?? "", value);
  return buildReading("crypto", value, zone, {
    source: "CoinMarketCap",
    sourceUrl: "https://coinmarketcap.com/charts/fear-and-greed-index/",
    updatedAt: latest?.timestamp
      ? parseInt(latest.timestamp, 10)
      : Math.floor(Date.now() / 1000),
    isProxy: false,
    prev:
      typeof hv?.yesterday?.score === "number" ? hv.yesterday.score : null,
    weekAgo:
      typeof hv?.lastWeek?.score === "number" ? hv.lastWeek.score : null,
  });
}

// ── 코인 폴백: alternative.me ────────────────────────────────────────
type FngApiEntry = {
  value: string; // 문자열 정수 (parseInt 필수)
  value_classification: string;
  timestamp: string;
};

async function fetchCryptoFng(): Promise<FearGreedReading> {
  // limit=8 → 최신 + 전일 + 1주 전 컨텍스트.
  const res = await fetchWithTimeout("https://api.alternative.me/fng/?limit=8", {
    timeoutMs: 5000,
    headers: {Accept: "application/json"},
  });
  if (!res.ok) throw new Error(`alternative.me HTTP ${res.status}`);
  const json = (await res.json()) as {data?: FngApiEntry[]};
  const arr = json.data;
  if (!arr || arr.length === 0) throw new Error("alternative.me empty data");

  const latest = arr[0];
  const value = parseInt(latest.value, 10);
  if (!Number.isFinite(value)) throw new Error("alternative.me bad value");
  const zone = zoneFromClassification(latest.value_classification, value);

  return buildReading("crypto", value, zone, {
    source: "alternative.me",
    sourceUrl: "https://alternative.me/crypto/fear-and-greed-index/",
    updatedAt: parseInt(latest.timestamp, 10) || Math.floor(Date.now() / 1000),
    isProxy: false,
    prev: arr[1] ? parseInt(arr[1].value, 10) : null,
    weekAgo: arr[7] ? parseInt(arr[7].value, 10) : null,
  });
}

// ── 미국 1순위: feargreedchart.com (CNN식 5-component 합성, 0-100) ──────────
async function fetchFeargreedchart(): Promise<FearGreedReading> {
  const res = await fetchWithTimeout(
    "https://feargreedchart.com/api/?action=all",
    {timeoutMs: 8000, headers: {Accept: "application/json"}}
  );
  if (!res.ok) throw new Error(`feargreedchart HTTP ${res.status}`);
  const json = (await res.json()) as {
    score?: {score?: number};
    ts?: number;
  };
  const raw = json.score?.score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error("feargreedchart bad score");
  }
  const value = Math.round(Math.max(0, Math.min(100, raw)));
  const zone = zoneFromValue(value);
  return buildReading("us", value, zone, {
    source: "feargreedchart.com",
    sourceUrl: "https://feargreedchart.com",
    updatedAt:
      typeof json.ts === "number"
        ? Math.floor(json.ts / 1000)
        : Math.floor(Date.now() / 1000),
    isProxy: false,
  });
}

// ── 미국 폴백: FRED VIXCLS (프록시) ───────────────────────────────────
/**
 * VIX 레벨 → 0-100 탐욕 점수. 낮은 VIX = 탐욕(높은 점수).
 * lo=10(탐욕 100) ~ hi=30(공포 0) 선형 클램프 — VIX 20(역사적 평균)이 중립(50)에 오도록 보정.
 * 즉 VIX<15 극단적 탐욕 / 15-19 탐욕 / ~20 중립 / 22-27 공포 / 28+ 극단적 공포.
 */
export function vixToGreedScore(vix: number): number {
  const lo = 10;
  const hi = 30;
  const t = (vix - lo) / (hi - lo);
  return Math.round(Math.max(0, Math.min(100, (1 - t) * 100)));
}

type VixRow = {date: string; vix: number};

/** FRED CSV 파싱 → 유효 행(결측 "." 제외) 오름차순. (테스트용 export) */
export function parseFredVixCsv(csv: string): VixRow[] {
  const lines = csv.trim().split("\n");
  const rows: VixRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // header skip
    const parts = lines[i].split(",");
    if (parts.length < 2) continue;
    const date = parts[0].trim();
    const raw = parts[1].trim();
    if (!raw || raw === ".") continue;
    const vix = Number(raw);
    if (!Number.isFinite(vix)) continue;
    rows.push({date, vix});
  }
  return rows;
}

async function fetchUsVix(): Promise<FearGreedReading> {
  const res = await fetchWithTimeout(
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS",
    {timeoutMs: 5000}
  );
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parseFredVixCsv(csv);
  if (rows.length === 0) throw new Error("FRED no valid VIX rows");

  const last = rows[rows.length - 1];
  const value = vixToGreedScore(last.vix);
  const zone = zoneFromValue(value);
  const updatedAt = Math.floor(new Date(`${last.date}T00:00:00Z`).getTime() / 1000);

  return buildReading("us", value, zone, {
    source: "FRED · CBOE VIX",
    sourceUrl: "https://fred.stlouisfed.org/series/VIXCLS",
    updatedAt: Number.isFinite(updatedAt)
      ? updatedAt
      : Math.floor(Date.now() / 1000),
    isProxy: true,
    detail: `VIX ${last.vix.toFixed(1)}`,
    prev:
      rows.length >= 2 ? vixToGreedScore(rows[rows.length - 2].vix) : null,
    weekAgo:
      rows.length >= 6 ? vixToGreedScore(rows[rows.length - 6].vix) : null,
  });
}

// ── 공개 로더 (KV 캐시 + stale 폴백) ──────────────────────────────────
async function fetchFresh(market: FearGreedMarket): Promise<FearGreedReading> {
  if (market === "crypto") {
    // CMC 1순위 (사용자 선호), 실패 시 alternative.me 폴백.
    try {
      return await fetchCmcFng();
    } catch {
      return await fetchCryptoFng();
    }
  }
  // 미국: feargreedchart 1순위, 실패 시 FRED VIX 프록시 폴백.
  try {
    return await fetchFeargreedchart();
  } catch {
    return await fetchUsVix();
  }
}

/**
 * 시장별 공포·탐욕 지수. KV 1h freshness + 7일 stale 폴백.
 * node(빌드 스크립트)에서는 KV 가 없어 매번 라이브 fetch — gen-og.ts 에서 직접 사용 가능.
 * 데이터 불가 + 캐시 없음 → null.
 */
export async function loadFearGreed(
  market: FearGreedMarket
): Promise<FearGreedReading | null> {
  const key = `fng:${market}`;
  const cached = await getKvJson<CachedReading>(key);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < FRESH_MS) {
    return cached;
  }

  try {
    const fresh = await fetchFresh(market);
    const toCache: CachedReading = {...fresh, fetchedAt: now};
    await setKvJson(key, toCache, {ttlSeconds: CACHE_TTL_SEC});
    return fresh;
  } catch {
    if (cached) return {...cached, stale: true}; // stale-while-error
    return null;
  }
}

// ── 히스토리 (지난 추이 차트) ─────────────────────────────────────────
export type FngHistoryPoint = {t: number; value: number}; // t = unix sec, value 0-100

const CMC_HIST_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchCryptoHistory(days: number): Promise<FngHistoryPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - days * 86400;
  const url = `https://api.coinmarketcap.com/data-api/v3/fear-greed/chart?start=${start}&end=${now}`;
  const res = await fetchWithTimeout(url, {
    timeoutMs: 8000,
    headers: {Accept: "application/json", "User-Agent": CMC_HIST_UA},
  });
  if (!res.ok) throw new Error(`CMC hist HTTP ${res.status}`);
  const json = (await res.json()) as {data?: {dataList?: CmcFngPoint[]}};
  const list = json.data?.dataList ?? [];
  const pts: FngHistoryPoint[] = [];
  for (const p of list) {
    const v = p.score;
    const t = p.timestamp ? parseInt(p.timestamp, 10) : NaN;
    if (typeof v === "number" && Number.isFinite(v) && Number.isFinite(t)) {
      pts.push({t, value: Math.round(v)});
    }
  }
  pts.sort((a, b) => a.t - b.t);
  return pts;
}

async function fetchUsHistory(days: number): Promise<FngHistoryPoint[]> {
  const res = await fetchWithTimeout(
    "https://feargreedchart.com/api/?action=history",
    {timeoutMs: 8000, headers: {Accept: "application/json"}}
  );
  if (!res.ok) throw new Error(`feargreedchart hist HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{date?: string; score?: number}>;
  if (!Array.isArray(arr)) throw new Error("feargreedchart hist: not array");
  const pts: FngHistoryPoint[] = [];
  for (const p of arr) {
    if (typeof p.score !== "number" || !p.date) continue;
    const t = Math.floor(new Date(`${p.date}T00:00:00Z`).getTime() / 1000);
    if (Number.isFinite(t)) pts.push({t, value: Math.round(p.score)});
  }
  pts.sort((a, b) => a.t - b.t);
  return pts.slice(-days);
}

/** 시장별 공포·탐욕 지수 히스토리(최근 days일). KV 6h fresh + 7일 stale. 실패 시 캐시/빈 배열. */
export async function loadFearGreedHistory(
  market: FearGreedMarket,
  days = 90
): Promise<FngHistoryPoint[]> {
  const key = `fng-hist:${market}:${days}`;
  const cached = await getKvJson<{pts: FngHistoryPoint[]; fetchedAt: number}>(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached.pts;
  try {
    const pts =
      market === "crypto"
        ? await fetchCryptoHistory(days)
        : await fetchUsHistory(days);
    if (pts.length === 0) return cached?.pts ?? [];
    await setKvJson(key, {pts, fetchedAt: now}, {ttlSeconds: 7 * 24 * 3600});
    return pts;
  } catch {
    return cached?.pts ?? [];
  }
}
