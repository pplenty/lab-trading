import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";

// 종목 상세 — 기간별 수익률 카드 (1주 / 1개월 / 3개월 / 1년 / 5년).
// D1 candles read → 현재가 vs 각 기간 시점 가격 비교.
// 데이터 부족 (해당 기간 봉 X) 면 그 카드만 hide ("—").

const DAY_SEC = 86400;

type Props = {
  class: AssetClass;
  symbol: string;
};

type PeriodReturn = {
  label: string;
  pct: number | null;
};

// (라벨, lookback 영업일 기준 — 영업일은 240/년 가정, 휴장 여유 위해 1.5x 캘린더일)
const PERIODS: Array<{label: string; days: number}> = [
  {label: "1주", days: 7},
  {label: "1개월", days: 31},
  {label: "3개월", days: 93},
  {label: "1년", days: 365},
  {label: "5년", days: 365 * 5},
];

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
    // 5년치 전부 read — D1 한 번 호출로 충분.
    const candles = await repo.range({
      symbol,
      from: now - PERIODS[PERIODS.length - 1].days * DAY_SEC - 30 * DAY_SEC,
      to: now + DAY_SEC,
    });
    if (candles.length < 2) return null;
    const last = candles[candles.length - 1];

    const returns: PeriodReturn[] = PERIODS.map(({label, days}) => {
      const targetT = last.t - days * DAY_SEC;
      // 가장 가까운 (이전 또는 같은 시점) 봉 찾기 — binary search 단순 linear.
      let baseline: number | null = null;
      for (let i = candles.length - 1; i >= 0; i--) {
        if (candles[i].t <= targetT) {
          baseline = candles[i].c;
          break;
        }
      }
      if (baseline === null) return {label, pct: null};
      if (baseline === 0) return {label, pct: null};
      return {label, pct: ((last.c - baseline) / baseline) * 100};
    });
    return {current: last.c, asOf: last.t, returns};
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
