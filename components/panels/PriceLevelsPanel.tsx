import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo, D1IndicatorRepo} from "@/lib/db/d1/repos";
import {INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";

// 종목 상세 — 52주 고저 + 현재가 위치 + SMA200/SMA50 대비 거리.
// 트레이딩 의사결정에 가장 자주 쓰이는 정보 4개를 카드로.
//
// D1 candles 1년치 + indicators 최신 row → SSR.
// 데이터 부족 시 섹션 hide.

const DAY_SEC = 86400;
const YEAR_DAYS = 365;

type Props = {
  class: AssetClass;
  symbol: string;
  currency: string;
};

type PriceLevelsData = {
  current: number;
  high52: {price: number; t: number};
  low52: {price: number; t: number};
  /** 52주 range 안에서 현재가 위치 (0-100%). */
  rangePct: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
};

async function loadData(symbol: string): Promise<PriceLevelsData | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const candleRepo = new D1CandleRepo(db);
    const indicatorRepo = new D1IndicatorRepo(db);
    const now = Math.floor(Date.now() / 1000);

    // 52주 candles (영업일 기준 ~260 + 여유 → 1.4년)
    const candles = await candleRepo.range({
      symbol,
      from: now - Math.ceil(YEAR_DAYS * 1.4) * DAY_SEC,
      to: now + DAY_SEC,
    });
    if (candles.length < 30) return null;

    // 52주 high/low — 가장 최근 ~260 영업일 (전체일 수도 그 미만이면 전체)
    const recent = candles.slice(-260);
    let hi = recent[0];
    let lo = recent[0];
    for (const c of recent) {
      if (c.h > hi.h) hi = c;
      if (c.l < lo.l) lo = c;
    }

    const last = candles[candles.length - 1];
    const current = last.c;
    const rangeHigh = hi.h;
    const rangeLow = lo.l;
    const range = rangeHigh - rangeLow || 1;
    const rangePct = ((current - rangeLow) / range) * 100;

    // 최신 indicator row. incremental cron 이 새 봉만 받아 SMA200 lookback 부족시 NULL —
    // 최근 14봉 (영업일 ~2주) 안에서 채워진 값 사용 (조금 stale 하지만 의사결정 영향 작음).
    const latestT = await indicatorRepo.latestT(symbol, INDICATORS_VERSION);
    let sma20: number | undefined;
    let sma50: number | undefined;
    let sma200: number | undefined;
    if (latestT !== null) {
      const rows = await indicatorRepo.range({
        symbol,
        from: latestT - 14 * DAY_SEC,
        to: latestT + 1,
        version: INDICATORS_VERSION,
      });
      // asc 정렬 — 역순으로 첫 non-null 찾기 (각 컬럼 독립)
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (sma20 === undefined && r.sma_20 !== undefined) sma20 = r.sma_20;
        if (sma50 === undefined && r.sma_50 !== undefined) sma50 = r.sma_50;
        if (sma200 === undefined && r.sma_200 !== undefined) sma200 = r.sma_200;
        if (sma20 !== undefined && sma50 !== undefined && sma200 !== undefined)
          break;
      }
    }

    return {
      current,
      high52: {price: rangeHigh, t: hi.t},
      low52: {price: rangeLow, t: lo.t},
      rangePct,
      sma20,
      sma50,
      sma200,
    };
  } catch {
    return null;
  }
}

function formatPrice(v: number, currency: string): string {
  if (currency === "KRW") {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(v);
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: v < 1 ? 5 : 2,
  }).format(v);
}

function formatDate(t: number): string {
  return new Date(t * 1000).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function distancePct(current: number, level: number | undefined): number | null {
  if (level === undefined || level === 0) return null;
  return ((current - level) / level) * 100;
}

export async function PriceLevelsPanel({class: cls, symbol, currency}: Props) {
  const _ = cls;
  void _;
  const data = await loadData(symbol);
  if (!data) return null;

  const fromHigh = ((data.current - data.high52.price) / data.high52.price) * 100;
  const fromLow = ((data.current - data.low52.price) / data.low52.price) * 100;
  const sma200Dist = distancePct(data.current, data.sma200);
  const sma50Dist = distancePct(data.current, data.sma50);
  const sma20Dist = distancePct(data.current, data.sma20);

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          가격 레벨
        </h2>
        <span className="text-[10px] text-fg-subtle">
          최근 52주 + 이동평균 (D1)
        </span>
      </header>

      {/* 52주 high/low + 현재가 위치 막대 */}
      <div className="mb-4 rounded-lg border border-line bg-surface/30 p-4">
        <div className="mb-3 flex items-end justify-between gap-3 text-[11px] text-fg-subtle">
          <div className="flex flex-col">
            <span>52주 최저</span>
            <span className="text-sm font-semibold tabular-nums text-fg">
              {formatPrice(data.low52.price, currency)}
            </span>
            <span className="text-fg-subtle">{formatDate(data.low52.t)}</span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span>52주 최고</span>
            <span className="text-sm font-semibold tabular-nums text-fg">
              {formatPrice(data.high52.price, currency)}
            </span>
            <span className="text-fg-subtle">{formatDate(data.high52.t)}</span>
          </div>
        </div>

        {/* 위치 막대 — 0% (low) ~ 100% (high) */}
        <div className="relative h-2 w-full rounded-full bg-line/60">
          <div
            className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm bg-accent"
            style={{left: `${Math.max(0, Math.min(100, data.rangePct))}%`}}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[11px]">
          <span className="text-fg-subtle">
            현재가 위치 <span className="font-semibold text-fg">{data.rangePct.toFixed(1)}%</span>
          </span>
          <span className="text-fg-subtle">
            최고가 대비 {fromHigh >= 0 ? "+" : ""}{fromHigh.toFixed(2)}% · 최저가 대비 {fromLow >= 0 ? "+" : ""}{fromLow.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 이동평균 거리 */}
      {(sma20Dist !== null || sma50Dist !== null || sma200Dist !== null) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SmaCard label="SMA 20" value={data.sma20} dist={sma20Dist} currency={currency} />
          <SmaCard label="SMA 50" value={data.sma50} dist={sma50Dist} currency={currency} />
          <SmaCard label="SMA 200" value={data.sma200} dist={sma200Dist} currency={currency} />
        </div>
      )}
    </section>
  );
}

function SmaCard({
  label,
  value,
  dist,
  currency,
}: {
  label: string;
  value: number | undefined;
  dist: number | null;
  currency: string;
}) {
  const tone =
    dist === null ? "neutral" : dist > 0 ? "up" : dist < 0 ? "down" : "neutral";
  const toneClass =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className="text-sm font-medium tabular-nums text-fg">
        {value !== undefined ? formatPrice(value, currency) : "—"}
      </div>
      <div className={`mt-0.5 text-xs font-semibold ${toneClass}`}>
        {dist !== null
          ? `${dist > 0 ? "▲ +" : dist < 0 ? "▼ " : ""}${dist.toFixed(2)}%`
          : "—"}
      </div>
    </article>
  );
}
