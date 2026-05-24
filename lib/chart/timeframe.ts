import type {Candle} from "@/lib/types";

// 차트 timeframe — 일봉(1d) 기반 + 주봉(1w) / 월봉(1mo) aggregate.
// D1 은 일봉만 저장 (ADR-0021). 주봉/월봉은 메모리 변환.

export type Timeframe = "1d" | "1w" | "1mo";

export const TIMEFRAMES: readonly Timeframe[] = ["1d", "1w", "1mo"] as const;

export const DEFAULT_TIMEFRAME: Timeframe = "1d";

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  "1d": "일봉",
  "1w": "주봉",
  "1mo": "월봉",
};

export function parseTimeframeParam(
  raw: string | string[] | undefined
): Timeframe {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (TIMEFRAMES as readonly string[]).includes(v)) return v as Timeframe;
  return DEFAULT_TIMEFRAME;
}

export function timeframeLabel(tf: Timeframe): string {
  return TIMEFRAME_LABEL[tf];
}

/**
 * 같은 bucket key 의 일봉들을 합쳐 1 봉으로 압축.
 * - open: bucket 첫 봉의 o
 * - high: bucket 내 max h
 * - low: bucket 내 min l
 * - close: bucket 마지막 봉의 c
 * - volume: bucket sum v
 * - t: bucket 첫 봉의 t (월 시작 / 주 시작 UTC)
 */
function aggregateByBucket(
  candles: Candle[],
  bucketKey: (c: Candle) => string
): Candle[] {
  if (candles.length === 0) return [];
  const groups = new Map<string, Candle[]>();
  for (const c of candles) {
    const k = bucketKey(c);
    const arr = groups.get(k) ?? [];
    arr.push(c);
    groups.set(k, arr);
  }
  // 입력이 시간순이라 가정. 그래도 t 기준 정렬.
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const ta = groups.get(a)![0].t;
    const tb = groups.get(b)![0].t;
    return ta - tb;
  });
  return sortedKeys.map((k) => {
    const bucket = groups.get(k)!;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    let high = first.h;
    let low = first.l;
    let volume = 0;
    for (const c of bucket) {
      if (c.h > high) high = c.h;
      if (c.l < low) low = c.l;
      volume += c.v;
    }
    return {
      t: first.t,
      o: first.o,
      h: high,
      l: low,
      c: last.c,
      v: volume,
    };
  });
}

/** UTC 월요일을 주 시작으로 — ISO week 정합. */
function weekBucketKey(c: Candle): string {
  const d = new Date(c.t * 1000);
  // UTC 기준 요일 (0=Sun ~ 6=Sat) → Monday 시작 (Mon=0 ~ Sun=6)
  const day = (d.getUTCDay() + 6) % 7;
  // Monday 자정 (UTC) 으로 round down
  const monday = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - day
  );
  return String(Math.floor(monday / 1000));
}

function monthBucketKey(c: Candle): string {
  const d = new Date(c.t * 1000);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

export function aggregateToWeekly(candles: Candle[]): Candle[] {
  return aggregateByBucket(candles, weekBucketKey);
}

export function aggregateToMonthly(candles: Candle[]): Candle[] {
  return aggregateByBucket(candles, monthBucketKey);
}

export function applyTimeframe(candles: Candle[], tf: Timeframe): Candle[] {
  if (tf === "1d") return candles;
  if (tf === "1w") return aggregateToWeekly(candles);
  return aggregateToMonthly(candles);
}
