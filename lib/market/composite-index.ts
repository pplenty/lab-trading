import {cache} from "react";
import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// 자산군별 자체 합성 지수 (equal-weight composite index).
// 80 종목의 일자별 close 를 가중평균 (등가중) → 시계열.
// normalized 100 base (첫 봉 = 100) — 자산군 절대 가격 무관, 추세 비교 가능.
//
// 데이터:
//   - D1 candles (recentBySymbols, 자산군 전체)
//   - 동일 t 모든 종목 close 필요 → t intersection
//   - 자산군의 일부 종목만 데이터 있을 수 있음 (최근 상장 / demo X) → 가능한 t 만
//
// 캐시: KV 1h (시계열 변동 작음).

const SECONDS_PER_DAY = 86400;

const RANGE_DAYS: Record<CompositeRange, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "5y": 1825,
};

export type CompositeRange = "1m" | "3m" | "6m" | "1y" | "5y";

export const COMPOSITE_RANGES: readonly CompositeRange[] = [
  "1m",
  "3m",
  "6m",
  "1y",
  "5y",
] as const;

export const DEFAULT_COMPOSITE_RANGE: CompositeRange = "1y";

export function parseCompositeRange(
  raw: string | string[] | undefined
): CompositeRange {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (COMPOSITE_RANGES as readonly string[]).includes(v))
    return v as CompositeRange;
  return DEFAULT_COMPOSITE_RANGE;
}

export function compositeRangeLabel(r: CompositeRange): string {
  switch (r) {
    case "1m":
      return "1개월";
    case "3m":
      return "3개월";
    case "6m":
      return "6개월";
    case "1y":
      return "1년";
    case "5y":
      return "5년";
  }
}

export type CompositePoint = {
  t: number; // unix sec
  v: number; // normalized 100 base
  /** 이 t 시점에 데이터가 있던 종목 수 (참고). */
  count: number;
};

export type CompositeIndex = {
  asset: AssetClass;
  range: CompositeRange;
  /** 정렬된 시계열. */
  points: CompositePoint[];
  /** 자산군 총 종목 수 (registry 기준). */
  totalSymbols: number;
  /** 최소 1 종목 이상 데이터가 있던 봉 수. */
  barCount: number;
  /** 첫 / 마지막 t. */
  firstT: number | null;
  lastT: number | null;
  /** 전체 기간 변동률 (last/first - 1) * 100. */
  totalReturnPct: number;
};

function getRegistrySymbols(asset: AssetClass): string[] {
  if (asset === "crypto") {
    return cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol);
  }
  if (asset === "us") {
    return usRegistry.map((e) => e.symbol);
  }
  return krRegistry.map((e) => e.symbol);
}

function emptyComposite(asset: AssetClass, range: CompositeRange): CompositeIndex {
  return {
    asset,
    range,
    points: [],
    totalSymbols: getRegistrySymbols(asset).length,
    barCount: 0,
    firstT: null,
    lastT: null,
    totalReturnPct: 0,
  };
}

async function buildComposite(
  asset: AssetClass,
  range: CompositeRange
): Promise<CompositeIndex> {
  if (!(await isDbAvailable())) {
    return emptyComposite(asset, range);
  }
  const symbols = getRegistrySymbols(asset);
  if (symbols.length === 0) return emptyComposite(asset, range);

  const days = RANGE_DAYS[range];
  const nowSec = Math.floor(Date.now() / 1000);
  const from = nowSec - (days + 2) * SECONDS_PER_DAY;
  const to = nowSec + SECONDS_PER_DAY;

  const db = await getDb();
  const repo = new D1CandleRepo(db);
  const byMap = await repo.recentBySymbols({
    symbols,
    from,
    to,
    perSymbol: days + 5,
  });

  // 모든 봉을 (t → [closes...]) 으로 모음.
  const closesByT = new Map<number, number[]>();
  // 각 종목의 첫 close 를 base 100 으로 정규화하기 위해 firstClose 보관.
  const firstByT = new Map<string, number | undefined>(); // symbol → first close
  // 종목별 sorted candles (시간 오름차순) 확보 — recentBySymbols 는 desc 일 수 있음.
  const symbolToSorted = new Map<string, Array<{t: number; c: number}>>();
  for (const sym of symbols) {
    const cs = byMap.get(sym);
    if (!cs || cs.length === 0) continue;
    const sorted = [...cs]
      .map((c) => ({t: c.t, c: c.c}))
      .filter((c) => Number.isFinite(c.c) && c.c > 0)
      .sort((a, b) => a.t - b.t);
    if (sorted.length === 0) continue;
    symbolToSorted.set(sym, sorted);
    firstByT.set(sym, sorted[0].c);
  }

  if (symbolToSorted.size === 0) return emptyComposite(asset, range);

  // 각 종목 close 를 첫 close 기준 normalized (× 100). 같은 t 의 평균으로 합성.
  for (const [sym, sorted] of symbolToSorted) {
    const first = firstByT.get(sym);
    if (first === undefined || first <= 0) continue;
    for (const p of sorted) {
      const norm = (p.c / first) * 100;
      const arr = closesByT.get(p.t) ?? [];
      arr.push(norm);
      closesByT.set(p.t, arr);
    }
  }

  // 시간순 정렬 + average.
  const sortedTs = [...closesByT.keys()].sort((a, b) => a - b);
  const points: CompositePoint[] = sortedTs.map((t) => {
    const arr = closesByT.get(t)!;
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    return {t, v: avg, count: arr.length};
  });

  // 시작점 = 다시 100 으로 재정규화 (모든 종목의 첫 봉 t 가 다를 수 있음).
  if (points.length > 0) {
    const base = points[0].v;
    if (base > 0) {
      for (const p of points) {
        p.v = (p.v / base) * 100;
      }
    }
  }

  const firstT = points[0]?.t ?? null;
  const lastT = points[points.length - 1]?.t ?? null;
  const totalReturnPct =
    points.length >= 2 && points[0].v > 0
      ? ((points[points.length - 1].v - points[0].v) / points[0].v) * 100
      : 0;

  return {
    asset,
    range,
    points,
    totalSymbols: symbols.length,
    barCount: points.length,
    firstT,
    lastT,
    totalReturnPct,
  };
}

/** 1h KV cache + RSC render cache. */
export const loadCompositeIndex = cache(
  async (asset: AssetClass, range: CompositeRange): Promise<CompositeIndex> => {
    const key = `composite:${asset}:${range}`;
    const hit = await getKvJson<CompositeIndex>(key);
    if (hit) return hit;
    const result = await buildComposite(asset, range);
    setKvJson(key, result, {ttlSeconds: 3600}).catch(() => {});
    return result;
  }
);
