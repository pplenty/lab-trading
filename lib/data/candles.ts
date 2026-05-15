import type {AssetClass, Candle, CandleSeries} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";

// 페이지 진입점 — D1 우선, 부족 시 어댑터 fallback (ADR-0021).
//
// 흐름:
//   1) D1 binding 있으면 D1CandleRepo.range 시도.
//      - 충분히 채워졌으면 (limit 의 70%+) D1 결과로 CandleSeries 합성. source="d1".
//      - 부족하면 어댑터로 fallback.
//   2) D1 unavailable 또는 부족 → 어댑터 getCandles 직접 호출. source 는 어댑터 식별자.
//
// 이 헬퍼는 페이지 / 백테스트 양쪽에서 호출. backfill 가 채운 D1 가 적중하면
// 외부 API 호출이 0회. miss 면 어댑터로 graceful degrade.

const DAY_SEC = 86400;

const ADAPTER_BY_CLASS = {
  crypto: upbitAdapter,
  us: twelveDataAdapter,
  kr: kisAdapter,
} as const;

const CURRENCY_BY_CLASS: Record<AssetClass, string> = {
  crypto: "KRW", // Upbit KRW 페어 기준
  us: "USD",
  kr: "KRW",
};

export type LoadCandlesOpts = {
  asset: AssetClass;
  symbol: string;
  /** 최근 N봉. 기본 200. */
  limit?: number;
  /** 명시적 시작 timestamp (sec, UTC). 없으면 now - limit*1.5 일 (휴장 여유). */
  fromT?: number;
  /** 명시적 끝 timestamp (sec, UTC). 없으면 now + 1d (오늘 포함). */
  toT?: number;
  /** D1 충분 판정 비율. 기본 0.7 (70%). */
  sufficiency?: number;
};

/**
 * D1 우선 candle 로드. CandleSeries 반환.
 * source 필드로 D1 적중 / 어댑터 fallback 식별 가능.
 */
export async function loadCandleSeries(
  opts: LoadCandlesOpts
): Promise<CandleSeries> {
  const limit = opts.limit ?? 200;
  const sufficiency = opts.sufficiency ?? 0.7;
  const now = Math.floor(Date.now() / 1000);
  const fromT = opts.fromT ?? now - Math.ceil(limit * 1.5) * DAY_SEC;
  const toT = opts.toT ?? now + DAY_SEC;

  // 1) D1 시도
  if (await isDbAvailable()) {
    try {
      const db = await getDb();
      const repo = new D1CandleRepo(db);
      const rows = await repo.range({symbol: opts.symbol, from: fromT, to: toT});
      if (rows.length >= Math.ceil(limit * sufficiency)) {
        const candles = rows.slice(-limit);
        return {
          symbol: opts.symbol,
          class: opts.asset,
          currency: CURRENCY_BY_CLASS[opts.asset],
          timeframe: "1d",
          candles,
          source: "d1",
          cachedAt: new Date().toISOString(),
        };
      }
    } catch {
      // D1 쿼리 실패는 graceful — 어댑터 fallback.
    }
  }

  // 2) 어댑터 fallback
  const adapter = ADAPTER_BY_CLASS[opts.asset];
  const series = await adapter.getCandles(opts.symbol, {
    timeframe: "1d",
    limit,
  });
  return series;
}

/**
 * D1 로 충분히 채워진 종목인지 빠르게 점검.
 * 페이지에서 "데이터 출처: D1 캐시" 같은 라벨용.
 */
export async function isCachedInD1(
  symbol: string,
  threshold: number = 100
): Promise<boolean> {
  if (!(await isDbAvailable())) return false;
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const rows = await repo.range({
      symbol,
      from: now - threshold * DAY_SEC,
      to: now + DAY_SEC,
    });
    return rows.length >= threshold;
  } catch {
    return false;
  }
}

/** 페이지가 source 라벨에 사용할 사람-친화 표기. */
export function formatCandleSource(source: string): string {
  if (source === "d1") return "D1 historical cache";
  if (source.startsWith("upbit")) return "Upbit · 라이브";
  if (source.startsWith("twelve")) return "Twelve Data · 라이브";
  if (source.startsWith("kis")) return "KIS · 라이브";
  if (source.includes("demo")) return `${source} (demo)`;
  return source;
}
