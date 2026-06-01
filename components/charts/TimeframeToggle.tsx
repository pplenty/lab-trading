import {Link} from "@/i18n/navigation";
import {
  TIMEFRAMES,
  type Timeframe,
  timeframeLabel,
} from "@/lib/chart/timeframe";
import type {ChartRange} from "@/lib/chart/range";
import {buildToggleHref} from "@/lib/chart/toggle-url";

// 차트 timeframe segmented control (일봉 / 주봉 / 월봉).
// URL ?tf=1d|1w|1mo (range 와 함께 보존). buildToggleHref 로 query append 버그 회피.

type Props = {
  basePath: string;
  current: Timeframe;
  range: ChartRange;
};

export function TimeframeToggle({basePath, current, range}: Props) {
  return (
    <div
      role="tablist"
      aria-label="차트 timeframe"
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface/40 p-0.5"
    >
      {TIMEFRAMES.map((tf) => {
        const active = tf === current;
        return (
          <Link
            key={tf}
            href={buildToggleHref(basePath, {range, tf})}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={`min-w-[44px] rounded px-2 py-1 text-center text-[11px] font-medium tabular-nums transition-colors ${
              active
                ? "bg-fg text-bg"
                : "text-fg-muted hover:bg-surface hover:text-fg"
            }`}
          >
            {timeframeLabel(tf)}
          </Link>
        );
      })}
    </div>
  );
}
