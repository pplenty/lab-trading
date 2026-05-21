import {Link} from "@/i18n/navigation";
import {CHART_RANGES, type ChartRange, rangeLabel} from "@/lib/chart/range";

// 차트 시간대 segmented control. URL ?range=... 로 RSC nav.
// 5y 는 1250 봉 (~25KB JSON) — 라이트한 lightweight-charts 무리 없음.

type Props = {
  basePath: string; // e.g. "/crypto/btc"
  current: ChartRange;
};

export function ChartRangeToggle({basePath, current}: Props) {
  return (
    <div
      role="tablist"
      aria-label="차트 기간"
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface/40 p-0.5"
    >
      {CHART_RANGES.map((r) => {
        const active = r === current;
        return (
          <Link
            key={r}
            href={`${basePath}?range=${r}`}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={`min-w-[44px] rounded px-2 py-1 text-center text-[11px] font-medium tabular-nums transition-colors ${
              active
                ? "bg-fg text-bg"
                : "text-fg-muted hover:bg-surface hover:text-fg"
            }`}
          >
            {rangeLabel(r)}
          </Link>
        );
      })}
    </div>
  );
}
