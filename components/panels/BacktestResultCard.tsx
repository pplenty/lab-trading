import nextDynamic from "next/dynamic";
import {FinancialDelta} from "@/components/FinancialDelta";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";
import {DrawdownChart} from "@/components/charts/DrawdownChart";
import {TradesTable} from "./TradesTable";
import type {BacktestResult} from "@/lib/backtest/types";
import type {Candle} from "@/lib/types";
import type {TradeMarker} from "@/components/charts/CandleChart";

const CandleChart = nextDynamic(() =>
  import("@/components/charts/CandleChart").then((m) => m.CandleChart)
);

// 백테스트 결과 카드 — 메트릭스 8 항목 + equity curve + trades 표.
// ADR-0019 의 `BacktestResult.metrics` 그대로 표시.

type Props = {
  result: BacktestResult;
  /** 초기 자본. equity → return % 변환에 사용. */
  initialCapital: number;
  /** 통화 — TradesTable 의 가격 포맷에 사용. */
  currency: string;
  /** 가격 차트 + 매수/매도 화살표 마커용 — 백테스트 입력 candles 그대로 전달. */
  candles?: Candle[];
};

const compactFmt = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

function fmtPct(v: number, digits = 2) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function BacktestResultCard({result, initialCapital, currency, candles}: Props) {
  const m = result.metrics;
  const equitySeries: LineSeries = {
    label: "Strategy",
    points: result.equityCurve.map((p) => ({t: p.t, v: p.v})),
    color: m.totalReturnPct >= 0 ? "var(--color-up)" : "var(--color-down)",
  };
  const buyHoldSeries: LineSeries = {
    label: "Buy & Hold",
    points: result.buyHoldCurve.map((p) => ({t: p.t, v: p.v})),
    color: "var(--color-fg-muted)",
    dashed: true,
  };

  // Drawdown curve — equity peak 대비 % 손실. MDD 지점 = 최저점.
  // peak[i] = max(equity[0..i]); dd[i] = (equity[i] - peak[i]) / peak[i] * 100
  const ddPoints: Array<{t: number; v: number}> = [];
  let ddPeak = -Infinity;
  let ddMaxIdx = -1;
  let ddMin = 0;
  for (let i = 0; i < result.equityCurve.length; i++) {
    const p = result.equityCurve[i];
    if (p.v > ddPeak) ddPeak = p.v;
    const dd = ddPeak > 0 ? ((p.v - ddPeak) / ddPeak) * 100 : 0;
    ddPoints.push({t: p.t, v: dd});
    if (dd < ddMin) {
      ddMin = dd;
      ddMaxIdx = i;
    }
  }
  // 전용 DrawdownChart 가 area + zero baseline 처리. ddPoints/ddMaxIdx/ddMin 만 활용.

  const finalEquity =
    result.equityCurve.length > 0
      ? result.equityCurve[result.equityCurve.length - 1].v
      : initialCapital;
  const buyHoldFinal =
    result.buyHoldCurve.length > 0
      ? result.buyHoldCurve[result.buyHoldCurve.length - 1].v
      : initialCapital;
  const buyHoldReturnPct = (buyHoldFinal / initialCapital - 1) * 100;

  // 전략 vs Buy&Hold 우위 — 사용자가 가장 알고 싶어하는 비교.
  const outperformPct = m.totalReturnPct - buyHoldReturnPct;
  const outperformAbs = finalEquity - buyHoldFinal;
  const outperformTone: "up" | "down" | "neutral" =
    outperformPct > 0.01 ? "up" : outperformPct < -0.01 ? "down" : "neutral";
  const verdict =
    outperformTone === "up"
      ? "전략이 단순 보유 대비 우위"
      : outperformTone === "down"
      ? "단순 보유가 전략 대비 우위"
      : "전략 ≈ 단순 보유";

  return (
    <div className="flex flex-col gap-6">
      {/* 전략 vs Buy&Hold 한 줄 결론 — 사용자 1초 판단 */}
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
          <div className="text-sm font-semibold text-fg">{verdict}</div>
          <div className="flex items-baseline gap-3 text-xs">
            <span className="text-fg-subtle">초과 수익</span>
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
            <span className="text-xs text-fg-subtle tabular-nums">
              ({outperformAbs >= 0 ? "+" : ""}
              {compactFmt.format(outperformAbs)})
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Total Return"
          value={fmtPct(m.totalReturnPct)}
          tone={
            m.totalReturnPct > 0 ? "up" : m.totalReturnPct < 0 ? "down" : "neutral"
          }
        />
        <Stat label="CAGR" value={fmtPct(m.cagrPct)} />
        <Stat
          label="MDD"
          value={`-${m.mddPct.toFixed(2)}%`}
          tone={m.mddPct > 0 ? "down" : "neutral"}
        />
        <Stat label="Sharpe" value={m.sharpe.toFixed(2)} />
        <Stat label="Sortino" value={m.sortino.toFixed(2)} />
        <Stat label="Win Rate" value={fmtPct(m.winRatePct)} />
        <Stat label="Trades" value={String(m.tradeCount)} />
        <Stat label="Avg Hold" value={`${m.avgHoldDays.toFixed(1)}d`} />
      </section>

      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-fg-muted">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{background: "var(--color-up)"}}
              />
              Strategy{" "}
              <span className="tabular-nums text-fg">
                <FinancialDelta changePct={m.totalReturnPct} />
              </span>
            </span>
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
              Buy & Hold{" "}
              <span className="tabular-nums text-fg-muted">
                <FinancialDelta changePct={buyHoldReturnPct} />
              </span>
            </span>
          </div>
          <span className="text-fg-subtle tabular-nums">
            Final: {compactFmt.format(finalEquity)}
          </span>
        </div>
        <LineChart
          series={[equitySeries, buyHoldSeries]}
          height={260}
          ariaLabel="Equity curve"
        />
      </section>

      {/* 가격 차트 + 매수/매도 마커 — "왜 이 시점에 매매했는가" 시각화. */}
      {candles && candles.length > 0 && result.trades.length > 0 && (
        <section className="rounded-lg border border-line bg-surface/30 p-4">
          <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <h3 className="text-sm font-semibold text-fg">매매 시그널</h3>
            <div className="flex items-center gap-3 text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-up)]" />
                매수 {result.trades.filter((t) => t.side === "buy").length}회
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-down)]" />
                매도 {result.trades.filter((t) => t.side === "sell").length}회
              </span>
            </div>
          </header>
          <CandleChart
            candles={candles}
            height={260}
            trades={result.trades.map((t) => ({
              t: t.t,
              side: t.side,
              text: t.reason,
            })) as TradeMarker[]}
          />
          <p className="mt-2 text-[10px] text-fg-subtle">
            ▲ 매수 시점 · ▼ 매도 시점 — 사유는 아래 거래 내역 참고
          </p>
        </section>
      )}

      {/* Drawdown chart — equity peak 대비 underwater. MDD 지점 marker. */}
      {ddPoints.length > 1 && (
        <section className="rounded-lg border border-line bg-surface/30 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-fg-muted">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-4 rounded-sm"
                style={{background: "var(--color-down)", opacity: 0.5}}
              />
              <span>Drawdown</span>
              <span className="ml-2 tabular-nums text-fg-subtle">
                MDD {fmtPct(ddMin, 2)}
              </span>
            </div>
            {ddMaxIdx >= 0 && (
              <span className="text-fg-subtle tabular-nums">
                저점 {new Date(ddPoints[ddMaxIdx].t * 1000).toISOString().slice(0, 10)}
              </span>
            )}
          </div>
          <DrawdownChart
            points={ddPoints}
            minIndex={ddMaxIdx >= 0 ? ddMaxIdx : undefined}
            height={140}
            ariaLabel="Drawdown underwater curve"
          />
        </section>
      )}

      <TradesTable trades={result.trades} currency={currency} maxRows={20} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  const colorClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg";
  return (
    <div className="rounded-md border border-line bg-bg p-3">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className={`mt-1 text-lg font-medium tabular-nums ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}
