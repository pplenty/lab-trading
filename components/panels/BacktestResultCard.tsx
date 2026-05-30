import nextDynamic from "next/dynamic";
import {TrendingUp, Zap, ArrowDownToLine, BarChart3, Target, Trophy, Repeat, Clock} from "lucide-react";
import {FinancialDelta} from "@/components/FinancialDelta";
import {type LineSeries} from "@/components/charts/LineChart";
import {ReplayLineChart} from "@/components/charts/ReplayLineChart";
import {DrawdownChart} from "@/components/charts/DrawdownChart";
import {MonthlyReturnsHeatmap} from "@/components/charts/MonthlyReturnsHeatmap";
import {TradesTable} from "./TradesTable";
import type {BacktestResult} from "@/lib/backtest/types";
import type {Candle} from "@/lib/types";

// 매매 시그널 + 거래 내역 (client + lightweight-charts 38KB) — 결과 표시 후에만 hydrate
const InteractiveBacktestTrades = nextDynamic(() =>
  import("./InteractiveBacktestTrades").then((m) => m.InteractiveBacktestTrades)
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
  /** CSV 내보내기 파일명 prefix (예: "btc-sma-cross"). */
  exportName?: string;
};

const compactFmt = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

function fmtPct(v: number, digits = 2) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function BacktestResultCard({
  result,
  initialCapital,
  currency,
  candles,
  exportName,
}: Props) {
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
          Icon={TrendingUp}
          label="총 수익률"
          hint="전체 기간 누적"
          value={fmtPct(m.totalReturnPct)}
          tone={m.totalReturnPct > 0 ? "up" : m.totalReturnPct < 0 ? "down" : "neutral"}
        />
        <Stat
          Icon={Zap}
          label="CAGR"
          hint="연복리 수익률"
          value={fmtPct(m.cagrPct)}
          tone={m.cagrPct > 0 ? "up" : m.cagrPct < 0 ? "down" : "neutral"}
        />
        <Stat
          Icon={ArrowDownToLine}
          label="MDD"
          hint="최대 낙폭"
          value={`-${m.mddPct.toFixed(2)}%`}
          tone={m.mddPct > 0 ? "down" : "neutral"}
        />
        <Stat
          Icon={BarChart3}
          label="Sharpe"
          hint="위험조정 수익률"
          value={m.sharpe.toFixed(2)}
          tone={m.sharpe > 1 ? "up" : m.sharpe < 0 ? "down" : "neutral"}
        />
        <Stat
          Icon={Target}
          label="Sortino"
          hint="하방위험조정"
          value={m.sortino.toFixed(2)}
          tone={m.sortino > 1 ? "up" : m.sortino < 0 ? "down" : "neutral"}
        />
        <Stat
          Icon={Trophy}
          label="승률"
          hint="수익 거래 비율"
          value={fmtPct(m.winRatePct, 1)}
          tone={m.winRatePct > 50 ? "up" : m.winRatePct < 40 ? "down" : "neutral"}
        />
        <Stat
          Icon={Repeat}
          label="거래 횟수"
          hint="round-trip"
          value={String(m.tradeCount)}
        />
        <Stat
          Icon={Clock}
          label="평균 보유"
          hint="포지션 지속 일수"
          value={`${m.avgHoldDays.toFixed(1)}일`}
        />
        <Stat
          Icon={Trophy}
          label="Profit Factor"
          hint="총이익 / |총손실| — 승률 보완. >1 이익 우세"
          value={
            m.tradeCount === 0
              ? "—"
              : m.profitFactor >= 999
              ? "∞"
              : m.profitFactor.toFixed(2)
          }
          tone={
            m.tradeCount === 0
              ? "neutral"
              : m.profitFactor >= 1.5
              ? "up"
              : m.profitFactor < 1
              ? "down"
              : "neutral"
          }
        />
        <Stat
          Icon={Target}
          label="손익비"
          hint="평균 이익 / |평균 손실| (payoff ratio)"
          value={m.tradeCount === 0 ? "—" : m.payoffRatio.toFixed(2)}
          tone={
            m.tradeCount === 0 ? "neutral" : m.payoffRatio >= 1.5 ? "up" : "neutral"
          }
        />
        <Stat
          Icon={ArrowDownToLine}
          label="최대 연속 손실"
          hint="연속으로 손실 본 거래 최대 횟수"
          value={m.tradeCount === 0 ? "—" : `${m.maxConsecutiveLosses}회`}
          tone={m.maxConsecutiveLosses >= 5 ? "down" : "neutral"}
        />
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
        <ReplayLineChart
          series={[equitySeries, buyHoldSeries]}
          height={260}
          ariaLabel="Equity curve"
        />
      </section>

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

      {/* 월별 수익률 heatmap — 시즌별 강세/약세 한 눈 시각화 */}
      <MonthlyReturnsHeatmap
        equity={result.equityCurve}
        initialCapital={initialCapital}
      />

      {/* 매매 시그널 차트 + 거래 내역 — table hover ↔ chart crosshair 연동 */}
      {candles && candles.length > 0 && result.trades.length > 0 ? (
        <InteractiveBacktestTrades
          candles={candles}
          trades={result.trades}
          currency={currency}
          exportName={exportName}
        />
      ) : (
        <TradesTable
          trades={result.trades}
          currency={currency}
          maxRows={20}
          exportName={exportName}
        />
      )}
    </div>
  );
}

function Stat({
  Icon,
  label,
  hint,
  value,
  tone,
}: {
  Icon?: typeof TrendingUp;
  label: string;
  hint?: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  const colorClass =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg";
  const borderClass =
    tone === "up"
      ? "border-[var(--color-up)]/30"
      : tone === "down"
      ? "border-[var(--color-down)]/30"
      : "border-line";
  return (
    <div className={`rounded-md border ${borderClass} bg-bg p-3 transition-colors`}>
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon
            size={12}
            className={
              tone === "up"
                ? "text-[var(--color-up)]"
                : tone === "down"
                ? "text-[var(--color-down)]"
                : "text-fg-subtle"
            }
            aria-hidden="true"
          />
        )}
        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
          {label}
        </div>
      </div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${colorClass}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-fg-subtle">{hint}</div>
      )}
    </div>
  );
}
