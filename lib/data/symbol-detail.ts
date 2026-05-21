import {cache} from "react";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo, D1IndicatorRepo} from "@/lib/db/d1/repos";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";
import type {Candle, IndicatorRow} from "@/lib/types";

// 종목 상세 위젯 5개 (Indicator / Volatility / Volume / PriceLevels / Returns) 가
// 같은 (symbol, latestT-120d, latestT) 범위를 fetch — RSC render 안에서 dedup.
// React `cache()` 는 같은 args 로 호출된 동일 render 호출만 dedup. 다음 SSR 은 새로 fetch.

const DAYS_BACK = 120;
const SECONDS_PER_DAY = 86400;

export const cachedLatestT = cache(async (symbol: string): Promise<number | null> => {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1IndicatorRepo(db);
    return await repo.latestT(symbol, INDICATORS_VERSION);
  } catch {
    return null;
  }
});

export const cachedIndicators120d = cache(
  async (symbol: string): Promise<IndicatorRow[] | null> => {
    const latestT = await cachedLatestT(symbol);
    if (latestT === null) return null;
    if (!(await isDbAvailable())) return null;
    try {
      const db = await getDb();
      const repo = new D1IndicatorRepo(db);
      return await repo.range({
        symbol,
        from: latestT - DAYS_BACK * SECONDS_PER_DAY,
        to: latestT + 1,
        version: INDICATORS_VERSION,
      });
    } catch {
      return null;
    }
  }
);

export const cachedCandles120d = cache(
  async (symbol: string): Promise<Candle[] | null> => {
    const latestT = await cachedLatestT(symbol);
    if (latestT === null) return null;
    if (!(await isDbAvailable())) return null;
    try {
      const db = await getDb();
      const repo = new D1CandleRepo(db);
      return await repo.range({
        symbol,
        from: latestT - DAYS_BACK * SECONDS_PER_DAY,
        to: latestT + 1,
      });
    } catch {
      return null;
    }
  }
);

// 52주 candle — PriceLevelsPanel 전용. 120d 와 범위 다르므로 별도 cache.
export const cachedCandles52w = cache(
  async (symbol: string): Promise<Candle[] | null> => {
    const latestT = await cachedLatestT(symbol);
    if (latestT === null) return null;
    if (!(await isDbAvailable())) return null;
    try {
      const db = await getDb();
      const repo = new D1CandleRepo(db);
      return await repo.range({
        symbol,
        from: latestT - 365 * SECONDS_PER_DAY,
        to: latestT + 1,
      });
    } catch {
      return null;
    }
  }
);
