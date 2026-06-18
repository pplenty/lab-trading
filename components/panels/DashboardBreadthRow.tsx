import type {AssetClass} from "@/lib/types";
import {Link} from "@/i18n/navigation";
import type {MarketBreadth} from "@/lib/market/breadth";

// 대시보드 "오늘 시장 폭" — 3 자산군 advance/decline 을 한 줄(3칸)로. 홈페이지엔
// per-asset 전체 뷰 없음 + F&G(코인·미국만)와 달리 KR 포함. 이미 로드된 quotes 파생(추가 쿼리 0).
// a11y: 색만으로 의미 전달 X — ▲/▼ + 부호 병기 (컨벤션 I).

type Props = {
  items: Array<{asset: AssetClass; label: string; breadth: MarketBreadth | null}>;
};

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function toneClass(v: number): string {
  return v > 0
    ? "text-[var(--color-up)]"
    : v < 0
    ? "text-[var(--color-down)]"
    : "text-fg-muted";
}

export function DashboardBreadthRow({items}: Props) {
  const rows = items.filter(
    (it): it is {asset: AssetClass; label: string; breadth: MarketBreadth} =>
      it.breadth !== null
  );
  if (rows.length === 0) return null;

  return (
    <section aria-label="오늘 시장 폭" className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        오늘 시장 폭
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map(({asset, label, breadth: b}) => (
          <Link
            key={asset}
            href={`/${asset}`}
            prefetch={false}
            className="rounded-lg border border-line bg-surface/40 px-4 py-3 transition-colors hover:border-accent"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-fg">{label}</span>
              <span className="text-xs tabular-nums text-fg-subtle">
                {b.total}종목
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm tabular-nums">
              <span className="flex items-center gap-2">
                <span className="text-[var(--color-up)]">▲ {b.up}</span>
                <span className="text-[var(--color-down)]">▼ {b.down}</span>
                {b.flat > 0 && (
                  <span className="text-fg-subtle">— {b.flat}</span>
                )}
              </span>
              <span className={toneClass(b.avgChangePct)}>
                평균 {fmtPct(b.avgChangePct)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
