import {cache} from "react";
import {getKvJson} from "@/lib/cache/kv-json";
import {runBacktest} from "@/lib/backtest/run";
import {strategies} from "@/lib/backtest/strategies/registry";
import type {AssetClass, Candle, IndicatorRow} from "@/lib/types";

// 백테스트 6 전략 default 파라미터 비교 결과 KV cache.
// /backtest/new 의 SSR cold start CPU 한도 trigger 회피.
// key: `bt-compare:{class}:{symbol}:{lastT}` — lastT 가 key 라 새 봉 들어오면 자동 fresh.

export type ComparisonRow = {
  id: string;
  nameKo: string;
  pct: number | null;
};

const INITIAL_CAPITAL = 10_000_000;
const FEE_PCT = 0.001;
const SLIPPAGE_PCT = 0.0005;

function key(cls: AssetClass, symbol: string, lastT: number): string {
  return `bt-compare:${cls}:${symbol}:${lastT}`;
}

/**
 * server-side fetch — KV cache hit 면 즉시, miss 면 null (caller 가 fallback).
 * KV miss 시 caller 가 client 측에서 compute + setKvJson 으로 cache write.
 *
 * react.cache() 로 같은 SSR render 안 dedup.
 */
export const loadComparisonFromCache = cache(
  async (
    cls: AssetClass,
    symbol: string,
    lastT: number
  ): Promise<ComparisonRow[] | null> => {
    return await getKvJson<ComparisonRow[]>(key(cls, symbol, lastT));
  }
);

/**
 * 6 전략 default 파라미터 백테스트 실행 — server 또는 client 모두 사용 가능.
 * 비용: 6 × strategy loop ~30-90ms. SSR 에서 직접 호출은 cold start 위험 — 권장 X.
 */
export function computeComparison(
  cls: AssetClass,
  symbol: string,
  candles: Candle[],
  indicators: IndicatorRow[] | undefined
): ComparisonRow[] {
  return strategies.map((s) => {
    const defaults: Record<string, number> = {};
    for (const p of s.params) defaults[p.key] = p.default;
    try {
      const r = runBacktest({
        symbol,
        class: cls,
        candles,
        indicators,
        strategyId: s.id,
        params: defaults,
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
      return {id: s.id, nameKo: s.nameKo, pct: r.metrics.totalReturnPct};
    } catch {
      return {id: s.id, nameKo: s.nameKo, pct: null};
    }
  });
}

// KV write 는 server-side cron 또는 별도 endpoint 에서. client 직접 write X.
