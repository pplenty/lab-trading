"use client";

import {useEffect, useMemo, useState} from "react";
import {Anchor, TrendingUp, Repeat, Mountain, Activity, GitBranch} from "lucide-react";
import {runBacktest} from "@/lib/backtest/run";
import {strategies, getStrategy} from "@/lib/backtest/strategies/registry";
import type {Candle, AssetClass, IndicatorRow} from "@/lib/types";
import {BacktestResultCard} from "./BacktestResultCard";
import {SaveStrategyButton} from "./SaveStrategyButton";
import {CopyResultUrlButton} from "./CopyResultUrlButton";
import {SymbolPicker} from "./SymbolPicker";

// 6 preset 별 icon + 짧은 캐치프레이즈. 카드 grid 의 빠른 직관 인식.
const STRATEGY_META: Record<
  string,
  {Icon: typeof Anchor; tagline: string}
> = {
  "buy-and-hold": {Icon: Anchor, tagline: "단순 보유"},
  "sma-cross": {Icon: TrendingUp, tagline: "이동평균 교차"},
  "rsi-reversion": {Icon: Repeat, tagline: "과매도/과매수 회귀"},
  "donchian-breakout": {Icon: Mountain, tagline: "N일 신고가 돌파"},
  "macd-cross": {Icon: Activity, tagline: "MACD 교차"},
  "bollinger-reversion": {Icon: GitBranch, tagline: "밴드 평균 회귀"},
};

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
  /** D1 사전계산 indicators — strategy 가 자체 계산 대신 우선 사용 (ADR-0021). */
  indicators?: IndicatorRow[];
  /** prefill (저장된 전략 로드 시). */
  initialStrategyId?: string;
  initialParams?: Record<string, number>;
  /** 종목 표시명 — "전략 저장" 의 디폴트 라벨에 사용. */
  symbolLabel?: string;
  /** server KV cache 에서 미리 받은 6 전략 비교 — null 면 client 가 useEffect 로 채움. */
  initialComparison?: Array<{id: string; nameKo: string; pct: number | null}>;
};

export function BacktestPanel({
  symbol,
  class: cls,
  currency,
  candles,
  indicators,
  initialStrategyId,
  initialParams,
  symbolLabel,
  initialComparison,
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

  // 선택된 전략 결과 — useMemo 도 RSC SSR pass 에서 실행되므로 useEffect 로 회피.
  // SSR HTML 엔 결과 placeholder (loading), client hydration 직후 채움.
  const [result, setResult] = useState<ReturnType<typeof runBacktest> | null>(null);
  useEffect(() => {
    if (!strategy || candles.length < 2) {
      setResult(null);
      return;
    }
    try {
      const r = runBacktest({
        symbol,
        class: cls,
        candles,
        indicators,
        strategyId,
        params,
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
      setResult(r);
    } catch (err) {
      console.error("runBacktest failed:", err);
      setResult(null);
    }
  }, [strategy, candles, indicators, symbol, cls, strategyId, params]);

  // 모든 전략 default 파라미터 결과 — "다른 전략은 어땠을까" 한 줄 비교.
  // **SSR 회피** — useMemo 는 RSC SSR pass 에서도 실행돼 6 × 200봉 simulation 이
  // cold start 50ms CPU 한도 trigger (Error 1102). useEffect 로 client hydration
  // 이후 계산 → SSR HTML 엔 빈 상태로 들어가고 client 측에서 채움.
  const [allResults, setAllResults] = useState<
    Array<{id: string; nameKo: string; pct: number | null}>
  >(initialComparison ?? []);
  useEffect(() => {
    // server-side KV cache hit → 이미 채워짐. client compute skip.
    if (initialComparison && initialComparison.length > 0) return;
    if (candles.length < 2) {
      setAllResults([]);
      return;
    }
    // requestIdleCallback 활용 가능 시 main thread 양보 — 미지원 환경은 즉시.
    const compute = () => {
      const out = strategies.map((s) => {
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
          return {id: s.id, nameKo: s.nameKo, pct: null as number | null};
        }
      });
      setAllResults(out);
    };
    const ric = (window as unknown as {requestIdleCallback?: (cb: () => void) => number})
      .requestIdleCallback;
    if (typeof ric === "function") {
      ric(compute);
    } else {
      setTimeout(compute, 0);
    }
  }, [candles, indicators, symbol, cls]);

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
        {/* Step 1 — 자산 selector + 자본 (read-only) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <span className="font-semibold uppercase tracking-wider">대상</span>
            <SymbolPicker
              currentLabel={`${symbolLabel ?? symbol.toUpperCase()} · ${symbol.toUpperCase()}`}
              preserveQuery={{
                strategy: strategyId,
                ...params,
              }}
            />
          </div>
          <div className="text-xs text-fg-subtle">
            <span className="font-semibold uppercase tracking-wider">초기 자본</span>{" "}
            <span className="ml-2 tabular-nums text-fg">
              {currencyFmt.format(INITIAL_CAPITAL)}
            </span>
          </div>
        </div>

        {/* Step 2 — 전략 카드 grid (dropdown 대체) */}
        <div className="mb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            전략 선택
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {strategies.map((s) => {
              const meta = STRATEGY_META[s.id] ?? {Icon: Anchor, tagline: ""};
              const Icon = meta.Icon;
              const active = s.id === strategyId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategyId(s.id)}
                  aria-pressed={active}
                  className={
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors " +
                    (active
                      ? "border-fg bg-surface-hover shadow-sm"
                      : "border-line bg-bg hover:border-fg-subtle hover:bg-surface")
                  }
                >
                  <div className="flex items-center gap-1.5">
                    <Icon
                      size={14}
                      className={active ? "text-accent" : "text-fg-muted"}
                      aria-hidden="true"
                    />
                    <span
                      className={
                        "text-xs font-semibold " +
                        (active ? "text-fg" : "text-fg-muted")
                      }
                    >
                      {s.nameKo}
                    </span>
                  </div>
                  <span className="text-[10px] text-fg-subtle">
                    {meta.tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3 — 선택된 전략 설명 + 파라미터 */}
        {strategy && (
          <div className="rounded-md border border-line bg-bg/40 p-3">
            <p className="text-[12px] leading-relaxed text-fg-muted">
              {strategy.descriptionKo}
            </p>
            {strategy.params.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {strategy.params.map((p) => (
                  <label key={p.key} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between text-[11px] font-medium text-fg-muted">
                      <span>{p.labelKo}</span>
                      <span className="tabular-nums text-fg">
                        {params[p.key] ?? p.default}
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
                    <span className="text-[10px] text-fg-subtle tabular-nums">
                      {p.min} ~ {p.max}
                    </span>
                  </label>
                ))}
              </div>
            )}
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

      {/* 전략 비교 — default 파라미터 기준 6 전략 한 줄. 선택된 strategy 클릭 가능. */}
      {allResults.length > 0 && (
        <section className="rounded-lg border border-line bg-surface/30 p-4">
          <header className="mb-2 flex items-baseline justify-between text-xs">
            <h3 className="text-sm font-semibold text-fg">전략 비교</h3>
            <span className="text-[10px] text-fg-subtle">
              default 파라미터 기준 · 클릭하면 전환
            </span>
          </header>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {allResults.map((r) => {
              const active = r.id === strategyId;
              const tone: "up" | "down" | "neutral" =
                r.pct === null
                  ? "neutral"
                  : r.pct > 0
                  ? "up"
                  : r.pct < 0
                  ? "down"
                  : "neutral";
              const toneClass =
                tone === "up"
                  ? "text-[var(--color-up)]"
                  : tone === "down"
                  ? "text-[var(--color-down)]"
                  : "text-fg-muted";
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setStrategyId(r.id)}
                  className={
                    "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors " +
                    (active
                      ? "border-fg bg-surface-hover"
                      : "border-line bg-bg hover:border-fg-subtle")
                  }
                >
                  <span className="text-[10px] text-fg-subtle truncate w-full">
                    {r.nameKo}
                  </span>
                  <span className={`text-sm font-semibold tabular-nums ${toneClass}`}>
                    {r.pct === null
                      ? "—"
                      : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {result ? (
        <BacktestResultCard
          result={result}
          initialCapital={INITIAL_CAPITAL}
          currency={currency}
          candles={candles}
        />
      ) : candles.length < 2 ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          데이터가 부족해 백테스트를 실행할 수 없습니다.
        </p>
      ) : (
        <div className="rounded-md border border-line bg-surface/30 p-6 text-center text-sm text-fg-muted">
          <span className="inline-block animate-pulse">백테스트 실행 중…</span>
        </div>
      )}
    </div>
  );
}
