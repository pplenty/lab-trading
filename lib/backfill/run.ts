import type {DataAdapter} from "@/lib/adapters/types";
import type {Candle} from "@/lib/types";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import {getDb} from "@/lib/db/d1/client";
import {
  D1CandleRepo,
  D1IndicatorRepo,
} from "@/lib/db/d1/repos";
import {computeIndicators, INDICATORS_VERSION} from "./indicators-batch";

// Historical 데이터 백필 orchestrator (ADR-0021).
//
// 두 모드:
//   1) one-shot 5 년 backfill — POST /api/backfill?asset=...&days=1825
//      어댑터의 getCandles 를 range chunk 로 반복 호출 → candles + indicators UPSERT.
//   2) 증분 cron — POST /api/cron/backfill
//      각 등록 종목의 latestT 조회 → 그 이후 봉만 fetch + indicators 부분 재계산.
//
// 어댑터별 1 회 호출 최대 봉 수:
//   Upbit       200 (KRW 일봉)
//   Binance     1000
//   Twelve Data 5000  → 5년치 1 회 OK
//   KIS         100

const DAY_SEC = 86400;

type Asset = "crypto-upbit" | "crypto-binance" | "us" | "kr";

// delayMs — chunk 간 sleep.
// Twelve Data 무료 8 req/min — 7500ms 보다 약간 여유 (8000ms).
// KIS — 모의 ~2/s, 실전 ~20/s. 1100ms 안전.
// Upbit/Binance — 단일 종목 직렬 호출에선 한도 여유.
//
// 단일 종목 backfill 은 chunk 가 1개라 delayMs 무관 (Twelve Data 5000봉/call 라 1825일 = 1 chunk).
// 그러나 *여러 종목 직렬 호출 시* 호출자(외부 cron / 스크립트) 책임 — backfill 모듈은 종목 간 sleep X.
const ADAPTER_MAP: Record<
  Asset,
  {adapter: DataAdapter; daysPerCall: number; delayMs: number}
> = {
  "crypto-upbit": {adapter: upbitAdapter, daysPerCall: 200, delayMs: 0},
  "crypto-binance": {adapter: {} as DataAdapter, daysPerCall: 1000, delayMs: 0}, // binanceAdapter 는 별도 등록 필요
  us: {adapter: twelveDataAdapter, daysPerCall: 5000, delayMs: 8000},
  kr: {adapter: kisAdapter, daysPerCall: 100, delayMs: 1100},
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** [start, end] 페어로 toT 부터 거꾸로 chunk 생성. */
function chunkRanges(
  fromT: number,
  toT: number,
  daysPerCall: number
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let cursor = toT;
  while (cursor > fromT) {
    const start = Math.max(fromT, cursor - daysPerCall * DAY_SEC);
    ranges.push([start, cursor]);
    cursor = start;
  }
  return ranges;
}

export type BackfillResult = {
  symbol: string;
  candlesInserted: number;
  indicatorsInserted: number;
  rangesFetched: number;
  error?: string;
};

/** 단일 종목 backfill — adapter 페이지네이션 + UPSERT + indicators. */
export async function backfillSymbol(opts: {
  adapter: DataAdapter;
  daysPerCall: number;
  symbol: string;
  fromT: number;
  toT: number;
  /** chunk 호출 사이 대기 (rate limit 회피). 기본 0. */
  delayMs?: number;
}): Promise<BackfillResult> {
  const db = await getDb();
  const candleRepo = new D1CandleRepo(db);
  const indicatorRepo = new D1IndicatorRepo(db);

  const ranges = chunkRanges(opts.fromT, opts.toT, opts.daysPerCall);
  const collected: Candle[] = [];
  let rangesFetched = 0;
  let lastError: string | undefined;
  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i];
    try {
      // 첫 호출 제외 chunk 간 rate-limit 회피 sleep.
      if (i > 0 && opts.delayMs && opts.delayMs > 0) await sleep(opts.delayMs);
      const series = await opts.adapter.getCandles(opts.symbol, {
        timeframe: "1d",
        from: start,
        to: end,
        limit: opts.daysPerCall,
      });
      collected.push(...series.candles);
      rangesFetched++;
      // 어댑터가 빈 응답 (더 이상 historical 없음) → early exit
      if (series.candles.length === 0) break;
    } catch (err) {
      // partial success — 일부 chunk 실패해도 지금까지 collected 데이터는 UPSERT.
      // (어댑터가 너무 과거 거부할 때 / rate limit 일시 차단 등에서 데이터 손실 방지)
      lastError = err instanceof Error ? err.message : String(err);
      break;
    }
  }

  // dedupe by t, sort 시간순.
  const dedupedMap = new Map<number, Candle>();
  for (const c of collected) dedupedMap.set(c.t, c);
  const candles = Array.from(dedupedMap.values()).sort((a, b) => a.t - b.t);

  const candlesInserted = await candleRepo.upsertMany(opts.symbol, candles);

  // indicators 계산 — 새 봉의 lookback (SMA200 등) 충족 위해 D1 의 과거 250 봉 합침.
  // incremental cron 이 1봉만 fetch 해도 SMA200 lookback period 확보. 5년치 일괄 backfill 시
  // candles 자체가 충분히 길어 lookback 거의 영향 X (D1 lookback 검색이 빈 결과).
  // 신규 봉의 indicator 만 UPSERT (과거 봉은 변경 X — recompute-indicators route 가 별도 처리).
  let indicatorsInserted = 0;
  if (candles.length > 0) {
    const newSetT = new Set(candles.map((c) => c.t));
    const earliestNew = candles[0].t;
    const lookbackCandles = await candleRepo.range({
      symbol: opts.symbol,
      from: earliestNew - 250 * DAY_SEC * 1.7, // 영업일 250 ≈ 1년 ~ 1.7년 달력일
      to: earliestNew, // exclusive — 새 봉 직전
    });
    const merged = [...lookbackCandles, ...candles];
    const indicators = computeIndicators(merged);
    // 새 봉의 indicator 만 추출 (과거 봉은 기존 D1 값 유지)
    const newIndicators = indicators.filter((r) => newSetT.has(r.t));
    indicatorsInserted = await indicatorRepo.upsertMany(
      opts.symbol,
      INDICATORS_VERSION,
      newIndicators
    );
  }

  return {
    symbol: opts.symbol,
    candlesInserted,
    indicatorsInserted,
    rangesFetched,
    // 일부 chunk 실패가 있었지만 부분 데이터는 저장된 경우 error 도 함께 노출 (관찰용).
    ...(lastError ? {error: lastError} : {}),
  };
}

/** 자산군 단위 backfill — 여러 종목 순차 처리 (rate limit 안전). */
export async function backfillAssetClass(opts: {
  asset: Asset;
  symbols: string[];
  fromT: number;
  toT: number;
}): Promise<BackfillResult[]> {
  const cfg = ADAPTER_MAP[opts.asset];
  if (!cfg) throw new Error(`backfill: unknown asset ${opts.asset}`);
  const results: BackfillResult[] = [];
  for (const symbol of opts.symbols) {
    const r = await backfillSymbol({
      adapter: cfg.adapter,
      daysPerCall: cfg.daysPerCall,
      symbol,
      fromT: opts.fromT,
      toT: opts.toT,
      delayMs: cfg.delayMs,
    });
    results.push(r);
  }
  return results;
}

/** 증분 backfill — 각 종목 latestT 이후 새 봉만 (cron 용도). */
export async function incrementalBackfill(opts: {
  asset: Asset;
  symbols: string[];
}): Promise<BackfillResult[]> {
  const db = await getDb();
  const candleRepo = new D1CandleRepo(db);
  const now = Math.floor(Date.now() / 1000);
  const results: BackfillResult[] = [];
  const cfg = ADAPTER_MAP[opts.asset];
  if (!cfg) throw new Error(`backfill: unknown asset ${opts.asset}`);

  for (const symbol of opts.symbols) {
    const latestT = await candleRepo.latestT(symbol);
    // 처음 backfill 이면 fromT 1년 전, 그렇지 않으면 latestT 직후.
    const fromT = latestT ?? now - 365 * DAY_SEC;
    const r = await backfillSymbol({
      adapter: cfg.adapter,
      daysPerCall: cfg.daysPerCall,
      symbol,
      fromT,
      toT: now,
      delayMs: cfg.delayMs,
    });
    results.push(r);
  }
  return results;
}
