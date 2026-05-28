"use client";

import {useEffect, useMemo, useState} from "react";
import {ArrowLeftRight} from "lucide-react";
import {runBacktest} from "@/lib/backtest/run";
import {strategies, getStrategy} from "@/lib/backtest/strategies/registry";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {AssetClass, Candle, IndicatorRow} from "@/lib/types";
import type {BacktestResult} from "@/lib/backtest/types";

// 2-strategy 비교 — 같은 종목에 전략 A vs B 결과 side-by-side.
// equity curve overlay (A / B / Buy&Hold) + metrics 표 (A vs B vs B&H) + verdict.
// 단순화: default params 사용 (slider 조정은 /backtest/new 에서).

const INITIAL_CAPITAL = 10_000_000;
const FEE_PCT = 0.001;
const SLIPPAGE_PCT = 0.0005;

const COLOR_A = "#3b82f6"; // blue
const COLOR_B = "#a855f7"; // violet

type Props = {
  class: AssetClass;
  symbol: string;
  currency: string;
  candles: Candle[];
  indicators?: IndicatorRow[];
  initialA: string;
  initialB: string;
};

function defaultParams(id: string): Record<string, number> {
  const s = getStrategy(id);
  if (!s) return {};
  const out: Record<string, number> = {};
  for (const p of s.params) out[p.key] = p.default;
  return out;
}

export function VsBacktestPanel({
  class: _cls,
  currency,
  candles,
  indicators,
  initialA,
  initialB,
}: Props) {
  void _cls;
  const [aId, setAId] = useState(initialA);
  const [bId, setBId] = useState(initialB);
  const [results, setResults] = useState<{a: BacktestResult; b: BacktestResult} | null>(
    null
  );

  // useEffect — client-only (useMemo 는 RSC SSR pass 에서 실행되어 1102 위험)
  useEffect(() => {
    if (candles.length < 2) {
      setResults(null);
      return;
    }
    try {
      const a = runBacktest({
        symbol: "vs:a",
        class: "crypto",
        candles,
        indicators,
        strategyId: aId,
        params: defaultParams(aId),
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
      const b = runBacktest({
        symbol: "vs:b",
        class: "crypto",
        candles,
        indicators,
        strategyId: bId,
        params: defaultParams(bId),
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
      setResults({a, b});
    } catch (err) {
      console.error("vs backtest failed:", err);
      setResults(null);
    }
  }, [aId, bId, candles, indicators]);

  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    [currency]
  );

  const stratA = getStrategy(aId);
  const stratB = getStrategy(bId);

  return (
    <div className="flex flex-col gap-6">
      {/* 전략 selector A / B */}
      <section className="grid gap-4 sm:grid-cols-2">
        <StrategyPicker
          label="전략 A"
          color={COLOR_A}
          value={aId}
          onChange={setAId}
          exclude={bId}
        />
        <StrategyPicker
          label="전략 B"
          color={COLOR_B}
          value={bId}
          onChange={setBId}
          exclude={aId}
        />
      </section>

      {!results ? (
        <div className="rounded-md border border-line bg-surface/30 p-6 text-center text-sm text-fg-muted">
          <span className="inline-block animate-pulse">백테스트 실행 중…</span>
        </div>
      ) : (
        <VsResult
          a={results.a}
          b={results.b}
          aName={stratA?.nameKo ?? aId}
          bName={stratB?.nameKo ?? bId}
          currencyFmt={currencyFmt}
        />
      )}
    </div>
  );
}

function StrategyPicker({
  label,
  color,
  value,
  onChange,
  exclude,
}: {
  label: string;
  color: string;
  value: string;
  onChange: (id: string) => void;
  exclude: string;
}) {
  const strat = getStrategy(value);
  return (
    <div className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{background: color}}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm text-fg focus:border-fg focus:outline-none"
      >
        {strategies.map((s) => (
          <option key={s.id} value={s.id} disabled={s.id === exclude}>
            {s.nameKo}
            {s.id === exclude ? " (반대편 선택됨)" : ""}
          </option>
        ))}
      </select>
      {strat && (
        <p className="mt-1.5 text-[11px] text-fg-subtle">{strat.descriptionKo}</p>
      )}
    </div>
  );
}

function VsResult({
  a,
  b,
  aName,
  bName,
  currencyFmt,
}: {
  a: BacktestResult;
  b: BacktestResult;
  aName: string;
  bName: string;
  currencyFmt: Intl.NumberFormat;
}) {
  const buyHoldReturn =
    a.buyHoldCurve.length >= 2 && a.buyHoldCurve[0].v > 0
      ? (a.buyHoldCurve[a.buyHoldCurve.length - 1].v / a.buyHoldCurve[0].v - 1) *
        100
      : 0;

  const aReturn = a.metrics.totalReturnPct;
  const bReturn = b.metrics.totalReturnPct;
  const winner = aReturn > bReturn ? "a" : bReturn > aReturn ? "b" : "tie";
  const diff = Math.abs(aReturn - bReturn);

  const series: LineSeries[] = [
    {
      label: aName,
      points: a.equityCurve.map((p) => ({t: p.t, v: p.v})),
      color: COLOR_A,
    },
    {
      label: bName,
      points: b.equityCurve.map((p) => ({t: p.t, v: p.v})),
      color: COLOR_B,
    },
    {
      label: "Buy & Hold",
      points: a.buyHoldCurve.map((p) => ({t: p.t, v: p.v})),
      color: "var(--color-fg-muted)",
      dashed: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* verdict */}
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <div className="flex flex-wrap items-center justify-center gap-3 text-center">
          <span
            className={
              "text-sm font-semibold " +
              (winner === "a" ? "text-[var(--color-up)]" : "text-fg-muted")
            }
          >
            {aName} {aReturn > 0 ? "+" : ""}
            {aReturn.toFixed(2)}%
          </span>
          <ArrowLeftRight size={14} aria-hidden="true" className="text-fg-subtle" />
          <span
            className={
              "text-sm font-semibold " +
              (winner === "b" ? "text-[var(--color-up)]" : "text-fg-muted")
            }
          >
            {bName} {bReturn > 0 ? "+" : ""}
            {bReturn.toFixed(2)}%
          </span>
        </div>
        <p className="mt-2 text-center text-xs text-fg-muted">
          {winner === "tie" ? (
            "두 전략 수익률 동일"
          ) : (
            <>
              <span className="font-semibold text-fg">
                {winner === "a" ? aName : bName}
              </span>{" "}
              가 {diff.toFixed(2)}%p 우위
            </>
          )}
        </p>
      </section>

      {/* equity overlay */}
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
          <Legend color={COLOR_A} label={aName} pct={aReturn} />
          <Legend color={COLOR_B} label={bName} pct={bReturn} />
          <span className="inline-flex items-center gap-1.5 text-fg-subtle">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-4"
              style={{
                background: "var(--color-fg-muted)",
                outline: "1px dashed var(--color-fg-muted)",
                outlineOffset: -1,
              }}
            />
            Buy &amp; Hold{" "}
            <span className="tabular-nums text-fg-muted">
              <FinancialDelta changePct={buyHoldReturn} />
            </span>
          </span>
        </div>
        <LineChart series={series} height={260} ariaLabel="전략 비교 equity curve" />
      </section>

      {/* metrics 표 */}
      <section className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
            <tr className="border-b border-line">
              <th className="px-4 py-2 text-left font-medium">지표</th>
              <th className="px-4 py-2 text-right font-medium" style={{color: COLOR_A}}>
                {aName}
              </th>
              <th className="px-4 py-2 text-right font-medium" style={{color: COLOR_B}}>
                {bName}
              </th>
              <th className="px-4 py-2 text-right font-medium text-fg-subtle">
                B&amp;H
              </th>
            </tr>
          </thead>
          <tbody>
            <MetricRow
              label="총 수익률"
              a={`${aReturn > 0 ? "+" : ""}${aReturn.toFixed(2)}%`}
              b={`${bReturn > 0 ? "+" : ""}${bReturn.toFixed(2)}%`}
              bh={`${buyHoldReturn > 0 ? "+" : ""}${buyHoldReturn.toFixed(2)}%`}
              best={winner}
            />
            <MetricRow
              label="CAGR"
              a={`${a.metrics.cagrPct.toFixed(2)}%`}
              b={`${b.metrics.cagrPct.toFixed(2)}%`}
              bh="—"
              best={a.metrics.cagrPct > b.metrics.cagrPct ? "a" : a.metrics.cagrPct < b.metrics.cagrPct ? "b" : "tie"}
            />
            <MetricRow
              label="MDD"
              a={`-${a.metrics.mddPct.toFixed(2)}%`}
              b={`-${b.metrics.mddPct.toFixed(2)}%`}
              bh="—"
              // MDD 는 작을수록 좋음
              best={a.metrics.mddPct < b.metrics.mddPct ? "a" : a.metrics.mddPct > b.metrics.mddPct ? "b" : "tie"}
            />
            <MetricRow
              label="Sharpe"
              a={a.metrics.sharpe.toFixed(2)}
              b={b.metrics.sharpe.toFixed(2)}
              bh="—"
              best={a.metrics.sharpe > b.metrics.sharpe ? "a" : a.metrics.sharpe < b.metrics.sharpe ? "b" : "tie"}
            />
            <MetricRow
              label="Sortino"
              a={a.metrics.sortino.toFixed(2)}
              b={b.metrics.sortino.toFixed(2)}
              bh="—"
              best={a.metrics.sortino > b.metrics.sortino ? "a" : a.metrics.sortino < b.metrics.sortino ? "b" : "tie"}
            />
            <MetricRow
              label="거래 수"
              a={`${a.metrics.tradeCount}`}
              b={`${b.metrics.tradeCount}`}
              bh="1"
              best="tie"
            />
            <MetricRow
              label="승률"
              a={`${a.metrics.winRatePct.toFixed(1)}%`}
              b={`${b.metrics.winRatePct.toFixed(1)}%`}
              bh="—"
              best={a.metrics.winRatePct > b.metrics.winRatePct ? "a" : a.metrics.winRatePct < b.metrics.winRatePct ? "b" : "tie"}
            />
            <MetricRow
              label="Profit Factor"
              a={a.metrics.profitFactor >= 999 ? "∞" : a.metrics.profitFactor.toFixed(2)}
              b={b.metrics.profitFactor >= 999 ? "∞" : b.metrics.profitFactor.toFixed(2)}
              bh="—"
              best={a.metrics.profitFactor > b.metrics.profitFactor ? "a" : a.metrics.profitFactor < b.metrics.profitFactor ? "b" : "tie"}
            />
            <MetricRow
              label="손익비"
              a={a.metrics.payoffRatio.toFixed(2)}
              b={b.metrics.payoffRatio.toFixed(2)}
              bh="—"
              best={a.metrics.payoffRatio > b.metrics.payoffRatio ? "a" : a.metrics.payoffRatio < b.metrics.payoffRatio ? "b" : "tie"}
            />
            <MetricRow
              label="최종 자산"
              a={currencyFmt.format(
                a.equityCurve.length ? a.equityCurve[a.equityCurve.length - 1].v : 0
              )}
              b={currencyFmt.format(
                b.equityCurve.length ? b.equityCurve[b.equityCurve.length - 1].v : 0
              )}
              bh={currencyFmt.format(
                a.buyHoldCurve.length ? a.buyHoldCurve[a.buyHoldCurve.length - 1].v : 0
              )}
              best={winner}
            />
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Legend({color, label, pct}: {color: string; label: string; pct: number}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-fg-muted">
      <span
        aria-hidden="true"
        className="inline-block h-0.5 w-4"
        style={{background: color}}
      />
      {label}{" "}
      <span className="tabular-nums text-fg">
        <FinancialDelta changePct={pct} />
      </span>
    </span>
  );
}

function MetricRow({
  label,
  a,
  b,
  bh,
  best,
}: {
  label: string;
  a: string;
  b: string;
  bh: string;
  best: "a" | "b" | "tie";
}) {
  return (
    <tr className="border-t border-line tabular-nums">
      <td className="px-4 py-2 text-fg-muted">{label}</td>
      <td
        className={
          "px-4 py-2 text-right " +
          (best === "a" ? "font-semibold text-fg" : "text-fg-muted")
        }
      >
        {a}
      </td>
      <td
        className={
          "px-4 py-2 text-right " +
          (best === "b" ? "font-semibold text-fg" : "text-fg-muted")
        }
      >
        {b}
      </td>
      <td className="px-4 py-2 text-right text-fg-subtle">{bh}</td>
    </tr>
  );
}
