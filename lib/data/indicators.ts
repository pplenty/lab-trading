import type {Candle, IndicatorRow} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1IndicatorRepo} from "@/lib/db/d1/repos";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";

// candles 배열에 대응하는 D1 사전계산 indicators 로드 (ADR-0021).
//
// runBacktest 의 config.indicators 는 candles 와 length 1:1 매칭이 필수.
// D1 의 indicators 가 일부 봉만 채워졌을 수 있으므로 t 기준 Map lookup → 빈 row 폴백.
// 데이터 출처:
//   1) D1 indicators (이상적) — backfill / recompute 가 채운 row
//   2) candles 와 t 불일치 또는 D1 미가용 → undefined 반환 (전략이 자체 계산 fallback)

export async function loadIndicatorsForCandles(
  symbol: string,
  candles: Candle[]
): Promise<IndicatorRow[] | undefined> {
  if (candles.length === 0) return undefined;
  if (!(await isDbAvailable())) return undefined;
  try {
    const db = await getDb();
    const repo = new D1IndicatorRepo(db);
    const fromT = candles[0].t;
    const toT = candles[candles.length - 1].t + 1;
    const rows = await repo.range({
      symbol,
      from: fromT,
      to: toT,
      version: INDICATORS_VERSION,
    });
    if (rows.length === 0) return undefined;
    // t → IndicatorRow map. 누락 봉은 빈 row (모든 필드 undefined) 로 fill —
    // strategy 가 indicators[i]?.sma_20 식으로 ?? 폴백 자체 계산하도록 디자인됨.
    const byT = new Map<number, IndicatorRow>();
    for (const r of rows) byT.set(r.t, r);
    return candles.map(
      (c) =>
        byT.get(c.t) ?? {
          t: c.t,
          computed_version: INDICATORS_VERSION,
        }
    );
  } catch {
    return undefined;
  }
}
