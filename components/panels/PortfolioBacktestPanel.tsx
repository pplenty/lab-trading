"use client";

import {useEffect, useMemo, useState} from "react";
import {X} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {SymbolPicker} from "./SymbolPicker";
import {runPortfolioBacktest, type PortfolioPosition, type PortfolioResult} from "@/lib/backtest/portfolio";
import {FinancialDelta} from "@/components/FinancialDelta";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";
import type {AssetClass, Candle} from "@/lib/types";

// 포트폴리오 백테스트 client panel — server 가 candles map prop 전달.
// weight slider 조정 시 useEffect 에서 runPortfolioBacktest 클라이언트 실행.

const INITIAL_CAPITAL = 10_000_000;
const FEE_PCT = 0.001;
const SLIPPAGE_PCT = 0.0005;

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04"];

type InitialPosition = {
  class: AssetClass;
  symbol: string;
  label: string;
  weight: number;
  candles: Candle[];
};

type Props = {
  initialPositions: InitialPosition[];
  /** "?symbols=..&weights=..&range=..." 의 range query. URL preserve 용. */
  range: string;
};

type PanelPosition = InitialPosition;

export function PortfolioBacktestPanel({initialPositions, range}: Props) {
  const [positions, setPositions] = useState<PanelPosition[]>(initialPositions);
  const [result, setResult] = useState<PortfolioResult | null>(null);

  // weight slider 또는 종목 변경 시 client-side 백테스트 재실행
  useEffect(() => {
    if (positions.length < 2) {
      setResult(null);
      return;
    }
    const config: Parameters<typeof runPortfolioBacktest>[0] = {
      positions: positions.map<PortfolioPosition>((p) => ({
        class: p.class,
        symbol: p.symbol,
        weight: p.weight,
        candles: p.candles,
      })),
      initialCapital: INITIAL_CAPITAL,
      rebalance: "none",
      feePct: FEE_PCT,
      slippagePct: SLIPPAGE_PCT,
    };
    try {
      setResult(runPortfolioBacktest(config));
    } catch (err) {
      console.error("runPortfolioBacktest failed:", err);
      setResult(null);
    }
  }, [positions]);

  function updateWeight(idx: number, w: number) {
    setPositions((prev) =>
      prev.map((p, i) => (i === idx ? {...p, weight: w} : p))
    );
  }

  function removePosition(idx: number) {
    setPositions((prev) => prev.filter((_, i) => i !== idx));
  }

  function rebalanceEqual() {
    const eq = 1 / positions.length;
    setPositions((prev) => prev.map((p) => ({...p, weight: eq})));
  }

  const totalWeight = positions.reduce((s, p) => s + p.weight, 0);
  const totalWeightPct = totalWeight * 100;

  // weight slider — sum 가 정확히 100 이 안 돼도 backtest 가 normalize. 안내만.
  const weightDeviation = Math.abs(totalWeightPct - 100);

  // currency format
  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "KRW",
        maximumFractionDigits: 0,
      }),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 종목 + weight 패널 */}
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg">포트폴리오 구성</h2>
          <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
            <button
              type="button"
              onClick={rebalanceEqual}
              className="rounded-md border border-line bg-bg px-2 py-1 transition-colors hover:border-fg hover:text-fg"
            >
              균등 배분
            </button>
            <span className="tabular-nums">
              총 {totalWeightPct.toFixed(0)}%
              {weightDeviation > 1 && (
                <span className="ml-1 text-[var(--color-down)]">
                  (자동 normalize)
                </span>
              )}
            </span>
          </div>
        </header>

        <ul className="flex flex-col gap-3">
          {positions.map((p, i) => (
            <li
              key={`${p.class}:${p.symbol}`}
              className="rounded-md border border-line bg-bg p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{background: COLORS[i % COLORS.length]}}
                  />
                  <Link
                    href={`/${p.class}/${p.symbol}`}
                    className="truncate text-sm font-medium text-fg hover:text-accent"
                  >
                    {p.label}
                  </Link>
                  <span className="text-[11px] text-fg-subtle">
                    {p.symbol.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-fg">
                    {(p.weight * 100).toFixed(0)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => removePosition(i)}
                    aria-label={`${p.label} 제거`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(p.weight * 100)}
                onChange={(e) => updateWeight(i, Number(e.target.value) / 100)}
                className="mt-2 w-full accent-accent"
                aria-label={`${p.label} 비중`}
              />
            </li>
          ))}
        </ul>

        {/* 종목 추가 */}
        {positions.length < 4 && (
          <div className="mt-3">
            <SymbolPicker
              currentLabel={`+ 종목 추가 (${positions.length}/4)`}
              destination={(e) => {
                const symbols = positions.map(
                  (p) => `${p.class}:${p.symbol}`
                );
                symbols.push(`${e.class}:${e.symbol}`);
                return `/backtest/portfolio?symbols=${symbols.join(",")}&range=${range}`;
              }}
            />
          </div>
        )}
      </section>

      {/* 결과 카드 */}
      {result ? (
        <PortfolioResultCard
          result={result}
          positions={positions}
          initialCapital={INITIAL_CAPITAL}
          currencyFmt={currencyFmt}
        />
      ) : positions.length < 2 ? (
        <div className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          최소 2 종목 이상 추가하세요.
        </div>
      ) : (
        <div className="rounded-md border border-line bg-surface/30 p-6 text-center text-sm text-fg-muted">
          <span className="inline-block animate-pulse">백테스트 실행 중…</span>
        </div>
      )}
    </div>
  );
}

function PortfolioResultCard({
  result,
  positions,
  initialCapital,
  currencyFmt,
}: {
  result: PortfolioResult;
  positions: PanelPosition[];
  initialCapital: number;
  currencyFmt: Intl.NumberFormat;
}) {
  const m = result.metrics;
  const finalEquity =
    result.equityCurve.length > 0
      ? result.equityCurve[result.equityCurve.length - 1].v
      : initialCapital;

  // equity curve + equal weight baseline
  const portfolioSeries: LineSeries = {
    label: "Portfolio",
    points: result.equityCurve.map((p) => ({t: p.t, v: p.v})),
    color: m.totalReturnPct >= 0 ? "var(--color-up)" : "var(--color-down)",
  };
  const equalSeries: LineSeries = {
    label: "Equal weight",
    points: result.equalWeightCurve.map((p) => ({t: p.t, v: p.v})),
    color: "var(--color-fg-muted)",
    dashed: true,
  };

  // outperformance vs equal weight
  const outperformPct = m.totalReturnPct - result.equalWeightReturn;
  const outperformTone: "up" | "down" | "neutral" =
    outperformPct > 0.01 ? "up" : outperformPct < -0.01 ? "down" : "neutral";

  return (
    <div className="flex flex-col gap-6">
      {/* verdict */}
      <section
        className={
          "rounded-lg border p-4 " +
          (outperformTone === "up"
            ? "border-[var(--color-up)]/40 bg-[var(--color-up)]/5"
            : outperformTone === "down"
            ? "border-[var(--color-down)]/40 bg-[var(--color-down)]/5"
            : "border-line bg-surface/30")
        }
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-fg">
            {outperformTone === "up"
              ? "사용자 weight 가 균등 배분 대비 우위"
              : outperformTone === "down"
              ? "균등 배분이 사용자 weight 대비 우위"
              : "사용자 weight ≈ 균등 배분"}
          </div>
          <div className="flex items-baseline gap-3 text-xs">
            <span className="text-fg-subtle">vs 균등 배분</span>
            <span
              className={
                "text-lg font-semibold tabular-nums " +
                (outperformTone === "up"
                  ? "text-[var(--color-up)]"
                  : outperformTone === "down"
                  ? "text-[var(--color-down)]"
                  : "text-fg-muted")
              }
            >
              {outperformPct > 0 ? "+" : ""}
              {outperformPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </section>

      {/* metrics */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="총 수익률"
          value={`${m.totalReturnPct > 0 ? "+" : ""}${m.totalReturnPct.toFixed(2)}%`}
          tone={m.totalReturnPct > 0 ? "up" : m.totalReturnPct < 0 ? "down" : "neutral"}
        />
        <Stat label="CAGR" value={`${m.cagrPct > 0 ? "+" : ""}${m.cagrPct.toFixed(2)}%`} />
        <Stat label="MDD" value={`-${m.mddPct.toFixed(2)}%`} tone={m.mddPct > 0 ? "down" : "neutral"} />
        <Stat label="Sharpe" value={m.sharpe.toFixed(2)} />
        <Stat label="Sortino" value={m.sortino.toFixed(2)} />
        <Stat label="최종 자산" value={currencyFmt.format(finalEquity)} />
        <Stat
          label="원금"
          value={currencyFmt.format(initialCapital)}
          subtle
        />
        <Stat
          label="순 손익"
          value={currencyFmt.format(finalEquity - initialCapital)}
          tone={finalEquity > initialCapital ? "up" : "down"}
        />
      </section>

      {/* equity curve */}
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{background: m.totalReturnPct >= 0 ? "var(--color-up)" : "var(--color-down)"}}
              />
              Portfolio{" "}
              <span className="tabular-nums text-fg">
                <FinancialDelta changePct={m.totalReturnPct} />
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-fg-subtle">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{background: "var(--color-fg-muted)", outline: "1px dashed var(--color-fg-muted)", outlineOffset: -1}}
              />
              Equal weight{" "}
              <span className="tabular-nums text-fg-muted">
                <FinancialDelta changePct={result.equalWeightReturn} />
              </span>
            </span>
          </div>
        </div>
        <LineChart
          series={[portfolioSeries, equalSeries]}
          height={260}
          ariaLabel="Portfolio equity curve"
        />
      </section>

      {/* per-asset 표 */}
      <section className="overflow-hidden rounded-lg border border-line">
        <div className="border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          자산별 기여도
        </div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
            <tr>
              <th className="px-4 py-2 text-left font-medium">종목</th>
              <th className="px-4 py-2 text-right font-medium">비중</th>
              <th className="px-4 py-2 text-right font-medium">수익률</th>
              <th className="px-4 py-2 text-right font-medium">최종 가치</th>
              <th className="px-4 py-2 text-right font-medium">기여도</th>
            </tr>
          </thead>
          <tbody>
            {result.perAsset.map((a, i) => (
              <tr key={`${a.class}:${a.symbol}`} className="border-t border-line">
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-full"
                      style={{background: COLORS[i % COLORS.length]}}
                    />
                    <span className="font-medium text-fg">
                      {positions[i]?.label ?? a.symbol.toUpperCase()}
                    </span>
                    <span className="text-xs text-fg-subtle">
                      {a.symbol.toUpperCase()}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                  {(a.weight * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <FinancialDelta changePct={a.returnPct} digits={2} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fg">
                  {currencyFmt.format(a.finalValue)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                  {a.contributionPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  subtle,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
  subtle?: boolean;
}) {
  const colorClass =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : subtle
      ? "text-fg-subtle"
      : "text-fg";
  return (
    <div className="rounded-md border border-line bg-bg p-3">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}
