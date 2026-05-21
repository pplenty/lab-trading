import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";

// 종목 상세 — 기간별 수익률 카드 (1주 / 1개월 / 3개월 / 1년 / 5년).
// 5y 전체 fetch (1250 봉) 가 cold start 시 CPU 한도 trigger 가능 → window 분리:
//   - recent 1y (250 봉) range query 1회 — 1주/1개월/3개월/1년 baseline 확보
//   - 5y (1825d) checkpoint 만 별도 좁은 range (≤30 봉) 1회 — 5y 카드만
// 합산 ~280 봉 (5y 1250 봉 대비 78% ↓)

const DAY_SEC = 86400;

type Props = {
  class: AssetClass;
  symbol: string;
};

type PeriodReturn = {
  label: string;
  pct: number | null;
};

// (라벨, lookback 캘린더일 — 휴장 여유 1.5x)
const PERIODS_RECENT: Array<{label: string; days: number}> = [
  {label: "1주", days: 7},
  {label: "1개월", days: 31},
  {label: "3개월", days: 93},
  {label: "1년", days: 365},
];

const PERIOD_5Y_DAYS = 365 * 5;

function findBaselineAtOrBefore(
  candles: Array<{t: number; c: number}>,
  targetT: number
): number | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].t <= targetT) return candles[i].c;
  }
  return null;
}

async function loadReturns(symbol: string): Promise<{
  current: number;
  asOf: number;
  returns: PeriodReturn[];
} | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);

    // window 1: 최근 1년 + 여유 30일 (~250 봉)
    const recentCandles = await repo.range({
      symbol,
      from: now - 365 * DAY_SEC - 30 * DAY_SEC,
      to: now + DAY_SEC,
    });
    if (recentCandles.length < 2) return null;
    const last = recentCandles[recentCandles.length - 1];

    const recentReturns: PeriodReturn[] = PERIODS_RECENT.map(({label, days}) => {
      const targetT = last.t - days * DAY_SEC;
      const baseline = findBaselineAtOrBefore(recentCandles, targetT);
      if (baseline === null || baseline === 0) return {label, pct: null};
      return {label, pct: ((last.c - baseline) / baseline) * 100};
    });

    // window 2: 5y 시점 ±30일 좁은 range (~30 봉) — 5y 카드 전용
    const target5y = last.t - PERIOD_5Y_DAYS * DAY_SEC;
    const fiveYearCandles = await repo.range({
      symbol,
      from: target5y - 30 * DAY_SEC,
      to: target5y + 30 * DAY_SEC,
    });
    let pct5y: number | null = null;
    const baseline5y = findBaselineAtOrBefore(fiveYearCandles, target5y);
    if (baseline5y !== null && baseline5y !== 0) {
      pct5y = ((last.c - baseline5y) / baseline5y) * 100;
    }

    return {
      current: last.c,
      asOf: last.t,
      returns: [...recentReturns, {label: "5년", pct: pct5y}],
    };
  } catch {
    return null;
  }
}

export async function ReturnsPanel({class: cls, symbol}: Props) {
  const _ = cls;
  void _;
  const data = await loadReturns(symbol);
  if (!data) return null;
  const hasAny = data.returns.some((r) => r.pct !== null);
  if (!hasAny) return null;

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          기간별 수익률
        </h2>
        <span className="text-[10px] text-fg-subtle">
          종가 기준 · {new Date(data.asOf * 1000).toLocaleDateString("ko-KR")}
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-5 grid-cols-3">
        {data.returns.map((r) => (
          <ReturnCard key={r.label} label={r.label} pct={r.pct} />
        ))}
      </div>
    </section>
  );
}

function ReturnCard({label, pct}: {label: string; pct: number | null}) {
  const tone: "up" | "down" | "neutral" =
    pct === null ? "neutral" : pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  const toneClass =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  const sign = pct !== null && pct > 0 ? "+" : "";
  return (
    <article className="rounded-md border border-line bg-surface/30 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
        {label}
      </div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>
        {pct === null ? "—" : `${sign}${pct.toFixed(2)}%`}
      </div>
    </article>
  );
}
