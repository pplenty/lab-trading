import {Sparkline} from "@/components/charts/Sparkline";
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
  stochK: number[];
  last: {
    rsi_14?: number;
    macd?: number;
    macd_signal?: number;
    stoch_k_14_3?: number;
    stoch_d_14_3?: number;
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
    const macd = recent.map((r) => r.macd).filter((v): v is number => v !== undefined);
    const stochK = recent
      .map((r) => r.stoch_k_14_3)
      .filter((v): v is number => v !== undefined);

    // 충분한 데이터 없으면 섹션 hide
    if (rsi.length < 5 && macd.length < 5 && stochK.length < 5) return null;

    return {rsi, macd, stochK, last};
  } catch {
    return null;
  }
}

export async function IndicatorPanel({symbol}: Props) {
  const data = await loadIndicatorPanelData(symbol);
  if (!data) return null;
  const {rsi, macd, stochK, last} = data;

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
      <div className="grid gap-3 sm:grid-cols-3">
        <IndicatorCard
          label="RSI (14)"
          primary={last.rsi_14}
          primaryFmt={(v) => v.toFixed(1)}
          status={rsiStatus(last.rsi_14)}
          data={rsi}
          footnote="30 과매도 · 70 과매수"
        />
        <IndicatorCard
          label="MACD (12, 26, 9)"
          primary={last.macd}
          primaryFmt={(v) => v.toFixed(2)}
          status={macdStatus(last.macd, last.macd_signal)}
          data={macd}
          footnote={
            last.macd_signal !== undefined
              ? `signal ${last.macd_signal.toFixed(2)}`
              : undefined
          }
        />
        <IndicatorCard
          label="Stochastic %K (14, 3)"
          primary={last.stoch_k_14_3}
          primaryFmt={(v) => v.toFixed(1)}
          status={stochStatus(last.stoch_k_14_3)}
          data={stochK}
          footnote={
            last.stoch_d_14_3 !== undefined
              ? `%D ${last.stoch_d_14_3.toFixed(1)}`
              : undefined
          }
        />
      </div>
    </section>
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

type CardProps = {
  label: string;
  primary: number | undefined;
  primaryFmt: (v: number) => string;
  status: {label: string; tone: "up" | "down" | "neutral"} | null;
  data: number[];
  footnote?: string;
};

function IndicatorCard({label, primary, primaryFmt, status, data, footnote}: CardProps) {
  const toneClass =
    status?.tone === "up"
      ? "text-[var(--color-up)]"
      : status?.tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-fg">
          {primary !== undefined ? primaryFmt(primary) : "—"}
        </span>
        {status && (
          <span className={`text-xs ${toneClass}`}>{status.label}</span>
        )}
      </div>
      <div className="h-10 w-full">
        <Sparkline values={data} width={200} height={40} className="w-full h-full" />
      </div>
      {footnote && (
        <p className="mt-1 text-[10px] text-fg-subtle">{footnote}</p>
      )}
    </article>
  );
}
