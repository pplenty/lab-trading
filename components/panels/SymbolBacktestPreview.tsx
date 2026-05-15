import {Link} from "@/i18n/navigation";
import {runBacktest} from "@/lib/backtest/run";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";
import type {AssetClass, Candle} from "@/lib/types";

// 종목 상세 페이지 미리보기 — 같은 화면 안에서 buy-and-hold 결과 즉시 노출.
// "한 화면에서 백테스트" 핵심 가치 명제 (ADR-0001) 의 가장 가벼운 진입점.
// runBacktest 가 pure function 이라 server (RSC) 에서 바로 실행 가능 — 클라이언트 JS 0.

const INITIAL_CAPITAL_BY_CURRENCY: Record<string, number> = {
  KRW: 10_000_000,
  USD: 10_000,
  USDT: 10_000,
};

type Props = {
  class: AssetClass;
  symbol: string;
  candles: Candle[];
  currency: string;
};

function fmtPct(v: number, digits = 2) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function SymbolBacktestPreview({
  class: cls,
  symbol,
  candles,
  currency,
}: Props) {
  if (candles.length < 30) {
    return null;
  }

  const initialCapital = INITIAL_CAPITAL_BY_CURRENCY[currency] ?? 10_000;
  let result;
  try {
    result = runBacktest({
      symbol,
      class: cls,
      candles,
      strategyId: "buy-and-hold",
      params: {},
      initialCapital,
      feePct: 0.001,
      slippagePct: 0.0005,
      fillModel: "next-open",
    });
  } catch {
    return null;
  }

  const m = result.metrics;
  const tone: "up" | "down" | "neutral" =
    m.totalReturnPct > 0 ? "up" : m.totalReturnPct < 0 ? "down" : "neutral";

  const series: LineSeries[] = [
    {
      label: "Equity",
      points: result.equityCurve.map((p) => ({t: p.t, v: p.v})),
      color: tone === "up" ? "var(--color-up)" : tone === "down" ? "var(--color-down)" : "var(--color-fg-muted)",
    },
  ];

  return (
    <section className="mb-6 rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-fg">
            Buy &amp; Hold · 최근 {candles.length} 봉 백테스트
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            초기 자본 {initialCapital.toLocaleString()} {currency} · 수수료 0.1% · 슬리피지 0.05% · 다음 봉 시가 체결
          </p>
        </div>
        <Link
          href={`/backtest/new?asset=${cls}&symbol=${symbol}`}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
        >
          다른 전략으로 →
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
          <Stat
            label="Total Return"
            value={fmtPct(m.totalReturnPct)}
            tone={tone}
          />
          <Stat label="CAGR" value={fmtPct(m.cagrPct)} />
          <Stat
            label="MDD"
            value={`-${m.mddPct.toFixed(2)}%`}
            tone={m.mddPct > 0 ? "down" : "neutral"}
          />
        </div>
        <div>
          <LineChart series={series} height={120} ariaLabel="Equity curve preview" />
        </div>
      </div>
    </section>
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
    <div className="rounded-md border border-line bg-bg p-2.5">
      <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-medium tabular-nums ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}
