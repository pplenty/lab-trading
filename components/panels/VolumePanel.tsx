import {VolatilityMiniChart} from "@/components/charts/VolatilityMiniChart";
import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1IndicatorRepo, D1CandleRepo} from "@/lib/db/d1/repos";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";

// 종목 상세 — 거래량 패널 (OBV + Volume vs SMA20)
// IndicatorPanel (모멘텀) / VolatilityPanel (가격 변동성) 과 정보 평면 분리.
// "거래량이 가격에 동의하느냐 / 평균 대비 어떠냐" 질문.
//
// OBV (On-Balance Volume) — 누적 거래량 (close ↑ → +volume, ↓ → -volume).
//   추세와 같이 가면 confirm, divergence 면 warning.
// Volume vs SMA20 — 오늘 거래량이 최근 20일 평균 대비 몇 배.

type Props = {
  class: AssetClass;
  symbol: string;
};

type PanelData = {
  obvSeries: number[];
  volRatioSeries: number[]; // volume / vol_sma_20
  last: {
    obv?: number;
    volume?: number;
    vol_sma_20?: number;
    volRatio?: number;
  };
};

async function loadData(symbol: string): Promise<PanelData | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1IndicatorRepo(db);
    const candleRepo = new D1CandleRepo(db);
    const latestT = await repo.latestT(symbol, INDICATORS_VERSION);
    if (latestT === null) return null;
    const from = latestT - 120 * 86400;
    const [indRows, candleRows] = await Promise.all([
      repo.range({symbol, from, to: latestT + 1, version: INDICATORS_VERSION}),
      candleRepo.range({symbol, from, to: latestT + 1}),
    ]);
    if (indRows.length === 0) return null;

    const volByT = new Map<number, number>();
    for (const c of candleRows) volByT.set(c.t, c.v);

    const recent = indRows.slice(-60);

    const obvSeries: number[] = [];
    const volRatioSeries: number[] = [];
    let lastObv: number | undefined;
    let lastVolSma: number | undefined;
    let lastVolume: number | undefined;
    let lastRatio: number | undefined;

    for (const r of recent) {
      if (r.obv !== undefined) {
        obvSeries.push(r.obv);
        lastObv = r.obv;
      }
      const v = volByT.get(r.t);
      if (v !== undefined && r.vol_sma_20 !== undefined && r.vol_sma_20 > 0) {
        const ratio = v / r.vol_sma_20;
        volRatioSeries.push(ratio);
        lastRatio = ratio;
        lastVolume = v;
        lastVolSma = r.vol_sma_20;
      }
    }

    if (obvSeries.length < 5 && volRatioSeries.length < 5) return null;

    return {
      obvSeries,
      volRatioSeries,
      last: {
        obv: lastObv,
        volume: lastVolume,
        vol_sma_20: lastVolSma,
        volRatio: lastRatio,
      },
    };
  } catch {
    return null;
  }
}

const volFmt = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

export async function VolumePanel({symbol}: Props) {
  const data = await loadData(symbol);
  if (!data) return null;
  const {obvSeries, volRatioSeries, last} = data;

  // OBV trend — 마지막 vs 평균 비교는 의미 약함 (누적 추세)
  // 대신 30봉 전 대비 변화율로 status
  const obvStatus = (() => {
    if (obvSeries.length < 30) return null;
    const past = obvSeries[obvSeries.length - 30];
    const now = obvSeries[obvSeries.length - 1];
    if (past === 0) return null;
    const pct = ((now - past) / Math.abs(past)) * 100;
    if (pct >= 5) return {label: "축적 (▲)", tone: "up" as const};
    if (pct <= -5) return {label: "분산 (▼)", tone: "down" as const};
    return {label: "횡보", tone: "neutral" as const};
  })();

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          거래량 지표
        </h2>
        <span className="text-[10px] text-fg-subtle">
          D1 사전계산 v{INDICATORS_VERSION}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <VolumeCard
          label="OBV — 누적 거래량"
          primary={
            last.obv !== undefined ? volFmt.format(last.obv) : "—"
          }
          status={obvStatus}
          values={obvSeries}
          footnote="close ↑ → +vol, ↓ → -vol. 30봉 전 대비 ±5%"
          ariaLabel="On-balance volume"
        />
        <VolumeCard
          label="Volume vs SMA20"
          primary={
            last.volRatio !== undefined
              ? `${last.volRatio.toFixed(2)}x`
              : "—"
          }
          subtitle={
            last.volume !== undefined && last.vol_sma_20 !== undefined
              ? `${volFmt.format(last.volume)} / ${volFmt.format(last.vol_sma_20)}`
              : undefined
          }
          status={
            last.volRatio !== undefined
              ? volRatioStatus(last.volRatio)
              : null
          }
          values={volRatioSeries}
          average={1.0}
          footnote="오늘 거래량 / 20일 평균 · 점선 = 1.0x"
          ariaLabel="Volume vs 20 day average ratio"
        />
      </div>
    </section>
  );
}

function volRatioStatus(
  r: number
): {label: string; tone: "up" | "down" | "neutral"} {
  if (r >= 2.0) return {label: "이례적 급증", tone: "down"};
  if (r >= 1.3) return {label: "활발", tone: "up"};
  if (r <= 0.6) return {label: "한산", tone: "neutral"};
  return {label: "보통", tone: "neutral"};
}

type CardProps = {
  label: string;
  primary: string;
  subtitle?: string;
  values: number[];
  average?: number;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  footnote?: string;
  ariaLabel?: string;
};

function VolumeCard({
  label,
  primary,
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
          {primary}
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
