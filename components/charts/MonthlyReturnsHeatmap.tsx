// 월별 수익률 heatmap — equity curve 의 월별 변화 시각화.
// y축: 연도 / x축: 1-12월 / cell color: +/- gradient (up/down 색)
// 우측 컬럼: 연간 누적 수익률.
//
// equity 시리즈에서 월별 변환:
//   month_return = equity[last_of_month] / equity[last_of_prev_month] - 1
// 첫 월은 equity[last_of_month] / initialCapital - 1.

import type {EquityPoint} from "@/lib/backtest/types";

type Props = {
  equity: EquityPoint[];
  initialCapital: number;
};

type MonthBucket = {
  year: number;
  month: number;
  pct: number | null;
};

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

function bucketize(
  equity: EquityPoint[],
  initialCapital: number
): MonthBucket[] {
  if (equity.length === 0) return [];
  const map = new Map<string, EquityPoint>();
  // 각 (year, month) 의 마지막 봉 equity 저장.
  for (const p of equity) {
    const d = new Date(p.t * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    map.set(key, p);
  }
  const sortedKeys = Array.from(map.keys()).sort((a, b) => {
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  const out: MonthBucket[] = [];
  let prev = initialCapital;
  for (const k of sortedKeys) {
    const point = map.get(k);
    if (!point) continue;
    const [y, m] = k.split("-").map(Number);
    const pct = prev > 0 ? (point.v / prev - 1) * 100 : null;
    out.push({year: y, month: m, pct});
    prev = point.v;
  }
  return out;
}

function colorForPct(pct: number | null): {bg: string; opacity: number} {
  if (pct === null) return {bg: "transparent", opacity: 0};
  const abs = Math.abs(pct);
  // opacity scale: 0% = 0.05, 1% = 0.15, 3% = 0.35, 5% = 0.6, 10%+ = 0.85
  const op = Math.min(0.85, 0.05 + (abs / 12) * 0.8);
  return {
    bg: pct > 0 ? "var(--color-up)" : pct < 0 ? "var(--color-down)" : "var(--fg-muted)",
    opacity: op,
  };
}

export function MonthlyReturnsHeatmap({equity, initialCapital}: Props) {
  const buckets = bucketize(equity, initialCapital);
  if (buckets.length === 0) return null;

  // year × month grid
  const yearSet = Array.from(new Set(buckets.map((b) => b.year))).sort();
  const grid = new Map<string, MonthBucket>();
  for (const b of buckets) grid.set(`${b.year}-${b.month}`, b);

  // 연간 누적 수익률 — 같은 year 의 모든 월 (1+r1)(1+r2)... - 1
  const yearTotals = new Map<number, number>();
  for (const y of yearSet) {
    let acc = 1;
    let any = false;
    for (let m = 0; m < 12; m++) {
      const b = grid.get(`${y}-${m}`);
      if (b?.pct !== null && b?.pct !== undefined) {
        acc *= 1 + b.pct / 100;
        any = true;
      }
    }
    if (any) yearTotals.set(y, (acc - 1) * 100);
  }

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-fg">월별 수익률</h3>
        <span className="text-[10px] text-fg-subtle">
          equity 월말 종가 기준 · 연간 누적
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[11px] tabular-nums">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-fg-subtle"></th>
              {MONTH_LABELS.map((m) => (
                <th
                  key={m}
                  className="px-1.5 py-1 text-center font-medium text-fg-subtle"
                >
                  {m}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-semibold text-fg-muted">
                연간
              </th>
            </tr>
          </thead>
          <tbody>
            {yearSet.map((y) => {
              const total = yearTotals.get(y);
              const totalColor = colorForPct(total ?? null);
              return (
                <tr key={y} className="border-t border-line/40">
                  <td className="px-2 py-1 font-medium text-fg-muted">{y}</td>
                  {Array.from({length: 12}, (_, m) => {
                    const b = grid.get(`${y}-${m}`);
                    const pct = b?.pct ?? null;
                    const c = colorForPct(pct);
                    const sign = pct !== null && pct > 0 ? "+" : "";
                    const label = pct === null ? "" : `${sign}${pct.toFixed(1)}`;
                    return (
                      <td
                        key={m}
                        className="px-1 py-1 text-center"
                        style={{
                          background:
                            pct === null
                              ? "transparent"
                              : `color-mix(in srgb, ${c.bg} ${c.opacity * 100}%, transparent)`,
                          color:
                            pct === null
                              ? "var(--fg-subtle)"
                              : c.opacity > 0.5
                              ? "var(--fg)"
                              : "var(--fg-muted)",
                        }}
                        title={pct === null ? "" : `${y}년 ${m + 1}월 ${label}%`}
                      >
                        {label}
                      </td>
                    );
                  })}
                  <td
                    className="px-2 py-1 text-right font-semibold"
                    style={{
                      background:
                        total === undefined
                          ? "transparent"
                          : `color-mix(in srgb, ${totalColor.bg} ${totalColor.opacity * 100}%, transparent)`,
                      color:
                        total !== undefined && totalColor.opacity > 0.5
                          ? "var(--fg)"
                          : "var(--fg-muted)",
                    }}
                  >
                    {total === undefined
                      ? "—"
                      : `${total > 0 ? "+" : ""}${total.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
