"use client";

import {useMemo, useState} from "react";
import {runBacktest} from "@/lib/backtest/run";
import {strategies, getStrategy} from "@/lib/backtest/strategies/registry";
import type {Candle, AssetClass} from "@/lib/types";
import {BacktestResultCard} from "./BacktestResultCard";
import {SaveStrategyButton} from "./SaveStrategyButton";
import {CopyResultUrlButton} from "./CopyResultUrlButton";

// 백테스트 클라이언트 패널 — 전략 selector + 파라미터 슬라이더 + 결과.
// candles 와 자산 메타는 server (RSC) 가 prop 으로 전달 (ADR-0019: 데이터는 서버 캐시 후 클라이언트).
// 실행은 클라이언트 메인 스레드 (Phase 1.1 Web Worker 이전).

const INITIAL_CAPITAL = 10_000_000; // ₩ 1 천만원 디폴트 (Upbit KRW 기준)
const FEE_PCT = 0.001; // 0.1%
const SLIPPAGE_PCT = 0.0005; // 0.05%

type Props = {
  symbol: string;
  class: AssetClass;
  currency: string;
  candles: Candle[];
  /** prefill (저장된 전략 로드 시). */
  initialStrategyId?: string;
  initialParams?: Record<string, number>;
  /** 종목 표시명 — "전략 저장" 의 디폴트 라벨에 사용. */
  symbolLabel?: string;
};

export function BacktestPanel({
  symbol,
  class: cls,
  currency,
  candles,
  initialStrategyId,
  initialParams,
  symbolLabel,
}: Props) {
  const [strategyId, setStrategyId] = useState<string>(
    initialStrategyId ?? "buy-and-hold"
  );
  const strategy = getStrategy(strategyId);

  // 전략 변경 시 디폴트 파라미터로 reset (initialParams 가 strategyId 와 매칭되면 그것 우선).
  const defaultParams = useMemo<Record<string, number>>(() => {
    const s = getStrategy(strategyId);
    if (!s) return {};
    const out: Record<string, number> = {};
    for (const p of s.params) out[p.key] = p.default;
    return out;
  }, [strategyId]);

  const [params, setParams] = useState<Record<string, number>>(
    initialParams && strategyId === initialStrategyId
      ? {...defaultParams, ...initialParams}
      : defaultParams
  );

  // strategyId 변경 시 params reset.
  if (strategy && Object.keys(params).length !== strategy.params.length) {
    setParams(defaultParams);
  }

  const result = useMemo(() => {
    if (!strategy || candles.length < 2) return null;
    try {
      return runBacktest({
        symbol,
        class: cls,
        candles,
        strategyId,
        params,
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
    } catch (err) {
      console.error("runBacktest failed:", err);
      return null;
    }
  }, [strategy, candles, symbol, cls, strategyId, params]);

  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: currency === "KRW" ? 0 : 2,
      }),
    [currency]
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
              Strategy
            </span>
            <select
              value={strategyId}
              onChange={(e) => {
                setStrategyId(e.target.value);
              }}
              className="rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg focus:border-fg focus:outline-none"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
              Asset / Capital
            </span>
            <div className="rounded-md border border-line bg-bg px-3 py-2 text-sm tabular-nums text-fg">
              {symbol.toUpperCase()} · {currencyFmt.format(INITIAL_CAPITAL)}
            </div>
          </div>
        </div>

        {strategy && strategy.params.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {strategy.params.map((p) => (
              <label key={p.key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-fg-muted">
                  {p.labelKo}{" "}
                  <span className="text-fg-subtle">
                    ({params[p.key] ?? p.default})
                  </span>
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step ?? (p.type === "int" ? 1 : 0.01)}
                  value={params[p.key] ?? p.default}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setParams((prev) => ({...prev, [p.key]: v}));
                  }}
                  className="accent-accent"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] text-fg-subtle">
            수수료 0.10% · 슬리피지 0.05% · 다음 봉 시가 체결 (룩어헤드 회피, ADR-0019)
          </p>
          {strategy && (
            <div className="flex flex-wrap gap-2">
              <CopyResultUrlButton
                class={cls}
                symbol={symbol}
                strategyId={strategyId}
                params={params}
              />
              <SaveStrategyButton
                strategyId={strategyId}
                params={params}
                class={cls}
                symbol={symbol}
                defaultLabel={symbolLabel ?? symbol.toUpperCase()}
                strategyName={strategy.name}
              />
            </div>
          )}
        </div>
      </section>

      {result ? (
        <BacktestResultCard
          result={result}
          initialCapital={INITIAL_CAPITAL}
          currency={currency}
        />
      ) : (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          데이터가 부족해 백테스트를 실행할 수 없습니다.
        </p>
      )}
    </div>
  );
}
