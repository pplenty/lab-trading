import {MacdMiniChart} from "@/components/charts/MacdMiniChart";
import {OscillatorMiniChart} from "@/components/charts/OscillatorMiniChart";
import {AdxMiniChart} from "@/components/charts/AdxMiniChart";
import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1IndicatorRepo} from "@/lib/db/d1/repos";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";

// 종목 상세 — D1 사전계산 indicator 노출 (Phase 2).
// RSI 14 + MACD + Stochastic — 가장 인기 모멘텀 지표 3종.
// D1 indicators read → 최근 60 row → 마지막 값 + sparkline.
//
// D1 미가용 / row 없음 시 섹션 자체 hide.

type Props = {
  class: AssetClass;
  symbol: string;
};

type IndicatorPanelData = {
  rsi: number[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  stochK: number[];
  stochD: number[];
  adx: number[];
  diPlus: number[];
  diMinus: number[];
  last: {
    rsi_14?: number;
    macd?: number;
    macd_signal?: number;
    stoch_k_14_3?: number;
    stoch_d_14_3?: number;
    adx_14?: number;
    di_plus_14?: number;
    di_minus_14?: number;
  };
};

async function loadIndicatorPanelData(
  symbol: string
): Promise<IndicatorPanelData | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1IndicatorRepo(db);
    const latestT = await repo.latestT(symbol, INDICATORS_VERSION);
    if (latestT === null) return null;
    const rows = await repo.range({
      symbol,
      from: latestT - 120 * 86400, // 최근 ~4개월 — 80 영업일 정도
      to: latestT + 1,
      version: INDICATORS_VERSION,
    });
    if (rows.length === 0) return null;

    const recent = rows.slice(-60);
    const last = recent[recent.length - 1];

    const rsi = recent.map((r) => r.rsi_14).filter((v): v is number => v !== undefined);
    // MACD 3 시리즈는 같은 봉에 모두 있어야 정렬 정합 — undefined 한 봉은 셋 다 skip.
    const macd: number[] = [];
    const macdSignal: number[] = [];
    const macdHist: number[] = [];
    for (const r of recent) {
      if (
        r.macd !== undefined &&
        r.macd_signal !== undefined &&
        r.macd_hist !== undefined
      ) {
        macd.push(r.macd);
        macdSignal.push(r.macd_signal);
        macdHist.push(r.macd_hist);
      }
    }
    // Stochastic %K + %D 도 같은 봉 정합 — 둘 다 있는 봉만 push.
    const stochK: number[] = [];
    const stochD: number[] = [];
    for (const r of recent) {
      if (r.stoch_k_14_3 !== undefined && r.stoch_d_14_3 !== undefined) {
        stochK.push(r.stoch_k_14_3);
        stochD.push(r.stoch_d_14_3);
      }
    }

    // ADX + DI+ + DI- 도 같은 봉 정합.
    const adx: number[] = [];
    const diPlus: number[] = [];
    const diMinus: number[] = [];
    for (const r of recent) {
      if (
        r.adx_14 !== undefined &&
        r.di_plus_14 !== undefined &&
        r.di_minus_14 !== undefined
      ) {
        adx.push(r.adx_14);
        diPlus.push(r.di_plus_14);
        diMinus.push(r.di_minus_14);
      }
    }

    // 충분한 데이터 없으면 섹션 hide
    if (rsi.length < 5 && macd.length < 5 && stochK.length < 5) return null;

    return {rsi, macd, macdSignal, macdHist, stochK, stochD, adx, diPlus, diMinus, last};
  } catch {
    return null;
  }
}

export async function IndicatorPanel({symbol}: Props) {
  const data = await loadIndicatorPanelData(symbol);
  if (!data) return null;
  const {rsi, macd, macdSignal, macdHist, stochK, stochD, adx, diPlus, diMinus, last} = data;

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          모멘텀 지표
        </h2>
        <span className="text-[10px] text-fg-subtle">
          D1 사전계산 v{INDICATORS_VERSION}
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OscillatorCard
          label="RSI (14)"
          primary={last.rsi_14}
          primaryFmt={(v) => v.toFixed(1)}
          status={rsiStatus(last.rsi_14)}
          values={rsi}
          lower={30}
          upper={70}
          footnote="30 과매도 · 70 과매수"
          ariaLabel="RSI 14"
        />
        <MacdCard
          primary={last.macd}
          signal={last.macd_signal}
          status={macdStatus(last.macd, last.macd_signal)}
          macd={macd}
          macdSignal={macdSignal}
          macdHist={macdHist}
        />
        <OscillatorCard
          label="Stochastic %K (14, 3)"
          primary={last.stoch_k_14_3}
          primaryFmt={(v) => v.toFixed(1)}
          status={stochStatus(last.stoch_k_14_3)}
          values={stochK}
          secondary={stochD}
          lower={20}
          upper={80}
          footnote={
            last.stoch_d_14_3 !== undefined
              ? `%D ${last.stoch_d_14_3.toFixed(1)} · 20 과매도 · 80 과매수`
              : "20 과매도 · 80 과매수"
          }
          ariaLabel="Stochastic K D 14 3"
        />
        <AdxCard
          primary={last.adx_14}
          plus={last.di_plus_14}
          minus={last.di_minus_14}
          status={adxStatus(last.adx_14)}
          adx={adx}
          diPlus={diPlus}
          diMinus={diMinus}
        />
      </div>
    </section>
  );
}

function adxStatus(v?: number) {
  if (v === undefined) return null;
  if (v >= 25) return {label: "추세 강함", tone: "up"} as const;
  if (v < 20) return {label: "추세 약함", tone: "neutral"} as const;
  return {label: "중간", tone: "neutral"} as const;
}

type AdxCardProps = {
  primary: number | undefined;
  plus: number | undefined;
  minus: number | undefined;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  adx: number[];
  diPlus: number[];
  diMinus: number[];
};

function AdxCard({primary, plus, minus, status, adx, diPlus, diMinus}: AdxCardProps) {
  const toneClass =
    status?.tone === "up"
      ? "text-[var(--color-up)]"
      : status?.tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  const direction =
    plus !== undefined && minus !== undefined
      ? plus > minus
        ? "상승 추세"
        : plus < minus
        ? "하락 추세"
        : "—"
      : "—";
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">
        ADX (14)
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">
          {primary !== undefined ? primary.toFixed(1) : "—"}
        </span>
        {status && <span className={`text-xs ${toneClass}`}>{status.label}</span>}
      </div>
      <div className="h-14 w-full">
        <AdxMiniChart
          adx={adx}
          plus={diPlus}
          minus={diMinus}
          width={200}
          height={56}
          className="w-full h-full"
          ariaLabel="ADX 14 with DI+ / DI-"
        />
      </div>
      <p className="mt-1 text-[10px] text-fg-subtle">
        DI+ {plus?.toFixed(1) ?? "—"} · DI- {minus?.toFixed(1) ?? "—"} · {direction}
      </p>
    </article>
  );
}

type OscillatorCardProps = {
  label: string;
  primary: number | undefined;
  primaryFmt: (v: number) => string;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  values: number[];
  secondary?: number[];
  lower: number;
  upper: number;
  footnote?: string;
  ariaLabel?: string;
};

function OscillatorCard({
  label,
  primary,
  primaryFmt,
  status,
  values,
  secondary,
  lower,
  upper,
  footnote,
  ariaLabel,
}: OscillatorCardProps) {
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
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">
          {primary !== undefined ? primaryFmt(primary) : "—"}
        </span>
        {status && <span className={`text-xs ${toneClass}`}>{status.label}</span>}
      </div>
      <div className="h-14 w-full">
        <OscillatorMiniChart
          values={values}
          secondary={secondary}
          lower={lower}
          upper={upper}
          domain={[0, 100]}
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

type MacdCardProps = {
  primary: number | undefined;
  signal: number | undefined;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
};

function MacdCard({primary, signal, status, macd, macdSignal, macdHist}: MacdCardProps) {
  const toneClass =
    status?.tone === "up"
      ? "text-[var(--color-up)]"
      : status?.tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">
        MACD (12, 26, 9)
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">
          {primary !== undefined ? primary.toFixed(2) : "—"}
        </span>
        {status && <span className={`text-xs ${toneClass}`}>{status.label}</span>}
      </div>
      <div className="h-14 w-full">
        <MacdMiniChart
          macd={macd}
          signal={macdSignal}
          histogram={macdHist}
          width={200}
          height={56}
          className="w-full h-full"
          ariaLabel="MACD 12-26-9"
        />
      </div>
      <p className="mt-1 text-[10px] text-fg-subtle">
        signal {signal !== undefined ? signal.toFixed(2) : "—"} · 점선 signal · 막대 hist
      </p>
    </article>
  );
}

function rsiStatus(v?: number) {
  if (v === undefined) return null;
  if (v >= 70) return {label: "과매수", tone: "down"} as const;
  if (v <= 30) return {label: "과매도", tone: "up"} as const;
  return {label: "중립", tone: "neutral"} as const;
}

function stochStatus(v?: number) {
  if (v === undefined) return null;
  if (v >= 80) return {label: "과매수", tone: "down"} as const;
  if (v <= 20) return {label: "과매도", tone: "up"} as const;
  return {label: "중립", tone: "neutral"} as const;
}

function macdStatus(m?: number, s?: number) {
  if (m === undefined || s === undefined) return null;
  return m > s
    ? {label: "▲ bull", tone: "up" as const}
    : {label: "▼ bear", tone: "down" as const};
}

