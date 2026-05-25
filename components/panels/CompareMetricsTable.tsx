"use client";

import {useState, useMemo} from "react";
import {ChevronDown, ChevronUp, ChevronsUpDown} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {CompareSeries} from "@/lib/compare/normalize";

// 비교 페이지의 메트릭 표 — sortable column.
// 클릭 시 toggle (none → desc → asc → none).

type Props = {
  series: CompareSeries[];
  colors: string[];
  /** series 와 1:1 — server 가 미리 계산한 ticker label (RSC → client function prop 금지). */
  tickers: string[];
};

type SortKey = "return" | "mdd" | "vol" | "sharpe" | null;
type SortDir = "asc" | "desc";

function nullLast(v: number | null, dir: SortDir): number {
  if (v === null) return dir === "desc" ? -Infinity : Infinity;
  return v;
}

export function CompareMetricsTable({series, colors, tickers}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    if (!sortKey) return series.map((s, idx) => ({s, idx}));
    const indexed = series.map((s, idx) => ({s, idx}));
    indexed.sort((a, b) => {
      const va = pick(a.s, sortKey);
      const vb = pick(b.s, sortKey);
      const na = nullLast(va, sortDir);
      const nb = nullLast(vb, sortDir);
      return sortDir === "desc" ? nb - na : na - nb;
    });
    return indexed;
  }, [series, sortKey, sortDir]);

  function toggle(key: Exclude<SortKey, null>) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      // unset
      setSortKey(null);
      setSortDir("desc");
    }
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
        <tr>
          <th className="px-4 py-2 text-left font-medium">종목</th>
          <SortableHeader
            label="수익률"
            active={sortKey === "return"}
            dir={sortDir}
            onClick={() => toggle("return")}
          />
          <SortableHeader
            label="MDD"
            active={sortKey === "mdd"}
            dir={sortDir}
            onClick={() => toggle("mdd")}
          />
          <SortableHeader
            label="Vol(연)"
            active={sortKey === "vol"}
            dir={sortDir}
            onClick={() => toggle("vol")}
            hint="annualized volatility"
          />
          <SortableHeader
            label="Sharpe"
            active={sortKey === "sharpe"}
            dir={sortDir}
            onClick={() => toggle("sharpe")}
            hint="annualized return / vol (rf=0)"
          />
          <th className="px-4 py-2 text-right font-medium">봉 수</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(({s, idx}) => (
          <tr
            key={`${s.entry.class}:${s.entry.symbol}`}
            className="border-t border-line"
          >
            <td className="px-4 py-2">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{background: colors[idx % colors.length]}}
                />
                <Link
                  href={`/${s.entry.class}/${s.entry.symbol}`}
                  className="font-medium text-fg hover:text-accent"
                >
                  {s.entry.label}
                </Link>
                <span className="text-xs text-fg-subtle">{tickers[idx]}</span>
              </span>
            </td>
            <td className="px-4 py-2 text-right tabular-nums">
              {s.totalReturnPct === null ? (
                "—"
              ) : (
                <FinancialDelta changePct={s.totalReturnPct} digits={2} />
              )}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
              {s.mddPct === null ? "—" : `-${s.mddPct.toFixed(2)}%`}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
              {s.volatilityPct === null
                ? "—"
                : `${s.volatilityPct.toFixed(1)}%`}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
              {s.sharpe === null ? "—" : s.sharpe.toFixed(2)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-fg-subtle">
              {s.entry.candles.length}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pick(s: CompareSeries, key: Exclude<SortKey, null>): number | null {
  if (key === "return") return s.totalReturnPct;
  if (key === "mdd") return s.mddPct === null ? null : -s.mddPct; // 음수일수록 나쁨
  if (key === "vol") return s.volatilityPct;
  return s.sharpe;
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  hint,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <th className="px-4 py-2 text-right font-medium">
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className={
          "inline-flex items-center gap-0.5 transition-colors hover:text-fg " +
          (active ? "text-fg" : "text-fg-subtle")
        }
      >
        {label}
        {active ? (
          dir === "desc" ? (
            <ChevronDown size={11} aria-hidden="true" />
          ) : (
            <ChevronUp size={11} aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown size={11} aria-hidden="true" className="opacity-50" />
        )}
      </button>
    </th>
  );
}
