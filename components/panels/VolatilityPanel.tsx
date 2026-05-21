import {VolatilityMiniChart} from "@/components/charts/VolatilityMiniChart";
import type {AssetClass} from "@/lib/types";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";
import {cachedIndicators120d, cachedCandles120d} from "@/lib/data/symbol-detail";

// 종목 상세 — 변동성 패널 (ATR + Bollinger Band Width)
// IndicatorPanel (모멘텀) 과 정보 평면 분리. "지금 변동성이 평소보다 크냐 작냐" 질문.
//
// ATR 14 — 절대값 + 가격 대비 % (가격 단위 다른 자산군 비교 가능)
// BB Width = (upper - lower) / middle * 100 — 정규화된 %

type Props = {
  class: AssetClass;
  symbol: string;
};

type PanelData = {
  atrSeries: number[];
  atrPctSeries: number[]; // ATR / close * 100
  bbWidthSeries: number[];
  last: {
    atr_14?: number;
    atrPct?: number;
    bbWidth?: number;
    close?: number;
  };
};

async function loadData(symbol: string): Promise<PanelData | null> {
  const [indRows, candleRows] = await Promise.all([
    cachedIndicators120d(symbol),
    cachedCandles120d(symbol),
  ]);
  if (!indRows || indRows.length === 0 || !candleRows) return null;
  try {

    // t -> close map for ATR % 계산
    const closeByT = new Map<number, number>();
    for (const c of candleRows) closeByT.set(c.t, c.c);

    const recent = indRows.slice(-60);

    const atrSeries: number[] = [];
    const atrPctSeries: number[] = [];
    const bbWidthSeries: number[] = [];
    let lastAtr: number | undefined;
    let lastAtrPct: number | undefined;
    let lastBbWidth: number | undefined;
    let lastClose: number | undefined;

    for (const r of recent) {
      const close = closeByT.get(r.t);
      if (r.atr_14 !== undefined) {
        atrSeries.push(r.atr_14);
        if (close !== undefined && close > 0) {
          const pct = (r.atr_14 / close) * 100;
          atrPctSeries.push(pct);
          lastAtrPct = pct;
        }
        lastAtr = r.atr_14;
      }
      if (
        r.bb_upper !== undefined &&
        r.bb_lower !== undefined &&
        r.bb_middle !== undefined &&
        r.bb_middle > 0
      ) {
        const w = ((r.bb_upper - r.bb_lower) / r.bb_middle) * 100;
        bbWidthSeries.push(w);
        lastBbWidth = w;
      }
      if (close !== undefined) lastClose = close;
    }

    if (atrSeries.length < 5 && bbWidthSeries.length < 5) return null;

    return {
      atrSeries,
      atrPctSeries,
      bbWidthSeries,
      last: {
        atr_14: lastAtr,
        atrPct: lastAtrPct,
        bbWidth: lastBbWidth,
        close: lastClose,
      },
    };
  } catch {
    return null;
  }
}

export async function VolatilityPanel({symbol}: Props) {
  const data = await loadData(symbol);
  if (!data) return null;
  const {atrSeries, atrPctSeries, bbWidthSeries, last} = data;

  const atrPctAvg = avgOf(atrPctSeries);
  const bbWidthAvg = avgOf(bbWidthSeries);

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          변동성 지표
        </h2>
        <span className="text-[10px] text-fg-subtle">
          D1 사전계산 v{INDICATORS_VERSION}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <VolatilityCard
          label="ATR (14) — 평균 진폭"
          primary={last.atrPct}
          primarySuffix="%"
          subtitle={
            last.atr_14 !== undefined
              ? `절대 ${last.atr_14.toFixed(last.atr_14 < 1 ? 4 : 2)}`
              : undefined
          }
          values={atrPctSeries}
          average={atrPctAvg}
          status={
            last.atrPct !== undefined && atrPctAvg !== undefined
              ? compareToAvg(last.atrPct, atrPctAvg, "변동성")
              : null
          }
          footnote={
            atrPctAvg !== undefined
              ? `최근 60일 평균 ${atrPctAvg.toFixed(2)}% · 점선 = 평균`
              : "가격 대비 % · 점선 = 평균"
          }
          ariaLabel="ATR percent of price"
        />
        <VolatilityCard
          label="BB Width — 밴드 폭"
          primary={last.bbWidth}
          primarySuffix="%"
          values={bbWidthSeries}
          average={bbWidthAvg}
          status={
            last.bbWidth !== undefined && bbWidthAvg !== undefined
              ? compareToAvg(last.bbWidth, bbWidthAvg, "밴드")
              : null
          }
          footnote={
            bbWidthAvg !== undefined
              ? `최근 60일 평균 ${bbWidthAvg.toFixed(2)}% · 점선 = 평균`
              : "상/하단 폭 / 중간 · 점선 = 평균"
          }
          ariaLabel="Bollinger Band width"
        />
      </div>
    </section>
  );
}

function avgOf(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function compareToAvg(
  current: number,
  avg: number,
  noun: string
): {label: string; tone: "up" | "down" | "neutral"} {
  const ratio = current / avg;
  if (ratio >= 1.3) return {label: `${noun} 확대`, tone: "down"};
  if (ratio <= 0.7) return {label: `${noun} 축소`, tone: "up"};
  return {label: "보통", tone: "neutral"};
}

type CardProps = {
  label: string;
  primary: number | undefined;
  primarySuffix?: string;
  subtitle?: string;
  values: number[];
  average?: number;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  footnote?: string;
  ariaLabel?: string;
};

function VolatilityCard({
  label,
  primary,
  primarySuffix,
  subtitle,
  values,
  average,
  status,
  footnote,
  ariaLabel,
}: CardProps) {
  const toneClass =
    status?.tone === "up"
      ? "text-[var(--color-up)]"
      : status?.tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">
          {primary !== undefined ? `${primary.toFixed(2)}${primarySuffix ?? ""}` : "—"}
        </span>
        {subtitle && (
          <span className="text-xs text-fg-subtle tabular-nums">{subtitle}</span>
        )}
        {status && <span className={`text-xs ${toneClass}`}>{status.label}</span>}
      </div>
      <div className="h-14 w-full">
        <VolatilityMiniChart
          values={values}
          average={average}
          width={200}
          height={56}
          className="w-full h-full"
          ariaLabel={ariaLabel}
        />
      </div>
      {footnote && <p className="mt-1 text-[10px] text-fg-subtle">{footnote}</p>}
    </article>
  );
}
