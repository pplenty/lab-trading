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
  /** 전략 vs 시장 — 같은 자산군 벤치마크(BTC/SPY/KOSPI200) 동기간 buy&hold 위험조정 지표. */
  benchmark?:
    | {
        label: string;
        totalReturnPct: number;
        cagrPct: number;
        mddPct: number;
        sharpe: number;
      }
    | null;
};

const compactFmt = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

function fmtPct(v: number, digits = 2) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

/** 전략 vs 시장 비교 셀 — 시장 대비 우위면 up 색, 열위면 down 색(MDD 는 낮을수록 우위). */
function BenchCell({
  self,
  other,
  fmt,
  higherBetter,
}: {
  self: number;
  other: number;
  fmt: (v: number) => string;
  higherBetter: boolean;
}) {
  const beats = higherBetter ? self > other : self < other;
  const cls =
    self === other
      ? "text-fg"
      : beats
      ? "text-[var(--color-up)]"
      : "text-[var(--color-down)]";
  return <span className={`text-center font-medium ${cls}`}>{fmt(self)}</span>;
}

export function BacktestResultCard({
  result,
  initialCapital,
  currency,
  candles,
  exportName,
  benchmark,
}: Props) {
  const m = result.metrics;
  // 전략 vs 시장 — 전략 총수익률 − 벤치마크 수익률.
  const vsMarketPct = benchmark
    ? m.totalReturnPct - benchmark.totalReturnPct
    : null;
  const vsMarketTone: "up" | "down" | "neutral" =
    vsMarketPct === null
      ? "neutral"
      : vsMarketPct > 0.01
      ? "up"
      : vsMarketPct < -0.01
      ? "down"
      : "neutral";
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

      {/* 전략 vs 시장 — 같은 자산군 벤치마크 동기간 buy&hold 위험조정 비교 */}
      {benchmark && vsMarketPct !== null && (
        <section className="-mt-3 rounded-md border border-line bg-bg/40 px-4 py-3 text-xs">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-fg-muted">
              같은 기간{" "}
              <span className="font-medium text-fg">시장 ({benchmark.label})</span>{" "}
              대비 위험조정 비교
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-fg-subtle">총수익 격차</span>
              <span
                className={
                  "text-base font-semibold tabular-nums " +
                  (vsMarketTone === "up"
                    ? "text-[var(--color-up)]"
                    : vsMarketTone === "down"
                    ? "text-[var(--color-down)]"
                    : "text-fg-muted")
                }
              >
                {fmtPct(vsMarketPct)}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-5 gap-x-2 gap-y-1 tabular-nums">
            <span className="text-fg-subtle" />
            <span className="text-center text-fg-subtle">총수익</span>
            <span className="text-center text-fg-subtle">CAGR</span>
            <span className="text-center text-fg-subtle">MDD</span>
            <span className="text-center text-fg-subtle">Sharpe</span>

            <span className="font-medium text-fg">전략</span>
            <BenchCell self={m.totalReturnPct} other={benchmark.totalReturnPct} fmt={fmtPct} higherBetter />
            <BenchCell self={m.cagrPct} other={benchmark.cagrPct} fmt={fmtPct} higherBetter />
            <BenchCell self={m.mddPct} other={benchmark.mddPct} fmt={(v) => `-${v.toFixed(2)}%`} higherBetter={false} />
            <BenchCell self={m.sharpe} other={benchmark.sharpe} fmt={(v) => v.toFixed(2)} higherBetter />

            <span className="text-fg-subtle">시장</span>
            <span className="text-center text-fg-muted">{fmtPct(benchmark.totalReturnPct)}</span>
            <span className="text-center text-fg-muted">{fmtPct(benchmark.cagrPct)}</span>
            <span className="text-center text-fg-muted">-{benchmark.mddPct.toFixed(2)}%</span>
            <span className="text-center text-fg-muted">{benchmark.sharpe.toFixed(2)}</span>
          </div>
        </section>
      )}

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

      {/* 백테스트 결과 면책 (ADR-0017) — 과거 성과·단순화 변수·미래 미보장 */}
      <p className="mt-4 rounded-md border border-line bg-surface/40 px-3 py-2 text-[11px] leading-relaxed text-fg-subtle">
        ⚠️ 백테스트 결과는 과거 데이터 기반 가상 시뮬레이션입니다. 수수료·슬리피지·세금이 단순화되어
        있고, 과거 성과는 미래 수익을 보장하지 않으며 실제 거래와 차이가 있을 수 있습니다. 투자 권유가
        아닙니다.
      </p>
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
