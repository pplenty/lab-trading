import {fetchWithTimeout} from "@/lib/adapters/_fetch";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";

// USD/KRW 환율 — 김치 프리미엄 계산 + 보조 통화 표시(ADR-0024)에 사용.
// Frankfurter(ECB, 일 1회) 1순위 → open.er-api.com 폴백. 둘 다 무키.
// KV 3h fresh + 7일 stale-while-error. 환율은 일 단위라 빈번 호출 불필요.

export type FxRate = {
  pair: string; // "USD/KRW"
  rate: number; // 1 USD = rate KRW
  date: string; // 기준일/시각
  source: string;
};

type CachedFx = FxRate & {fetchedAt: number};

const FRESH_MS = 3 * 60 * 60 * 1000; // 3h
const CACHE_TTL_SEC = 7 * 24 * 3600;

async function fetchFrankfurter(): Promise<FxRate> {
  const res = await fetchWithTimeout(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW",
    {timeoutMs: 5000, headers: {Accept: "application/json"}}
  );
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const j = (await res.json()) as {date?: string; rates?: {KRW?: number}};
  const r = j.rates?.KRW;
  if (typeof r !== "number" || !Number.isFinite(r)) {
    throw new Error("frankfurter: no KRW rate");
  }
  return {pair: "USD/KRW", rate: r, date: j.date ?? "", source: "Frankfurter · ECB"};
}

async function fetchErApi(): Promise<FxRate> {
  const res = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD", {
    timeoutMs: 5000,
    headers: {Accept: "application/json"},
  });
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
  const j = (await res.json()) as {
    rates?: {KRW?: number};
    time_last_update_utc?: string;
  };
  const r = j.rates?.KRW;
  if (typeof r !== "number" || !Number.isFinite(r)) {
    throw new Error("er-api: no KRW rate");
  }
  return {
    pair: "USD/KRW",
    rate: r,
    date: (j.time_last_update_utc ?? "").slice(0, 16),
    source: "er-api.com",
  };
}

async function fetchFresh(): Promise<FxRate> {
  try {
    return await fetchFrankfurter();
  } catch {
    return await fetchErApi();
  }
}

/** USD/KRW 환율. KV 3h fresh + 7일 stale 폴백. 실패 + 캐시 없음 → null. */
export async function loadUsdKrw(): Promise<FxRate | null> {
  const key = "fx:usdkrw";
  const cached = await getKvJson<CachedFx>(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < FRESH_MS) return cached;
  try {
    const fresh = await fetchFresh();
    await setKvJson(key, {...fresh, fetchedAt: now}, {ttlSeconds: CACHE_TTL_SEC});
    return fresh;
  } catch {
    return cached ?? null;
  }
}
