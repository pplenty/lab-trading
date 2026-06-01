import {Link} from "@/i18n/navigation";
import type {FearGreedReading} from "@/lib/market/fear-greed";
import {buildGaugeInner, ZONE_COLORS} from "@/lib/market/gauge";

// 인덱스 페이지(/crypto · /us)용 단일 시장 공포·탐욕 칩 — 작은 게이지 + 값 + 라벨.
// 카드 전체 /market 링크. reading null 이면 미표시 (KR 등 소스 없는 경우).
// 추가 클라이언트 JS 0 (RSC 인라인 SVG, lib/market/gauge 공유).

export function FearGreedChip({
  reading,
}: {
  reading: FearGreedReading | null;
}) {
  if (!reading) return null;
  const {value, zone, labelKo, source} = reading;
  const gauge = buildGaugeInner({
    cx: 50,
    cy: 46,
    r: 38,
    strokeWidth: 8,
    value,
    needleColor: "currentColor",
  });
  return (
    <Link
      href="/market"
      className="group inline-flex items-center gap-3 rounded-lg border border-line bg-surface/30 px-4 py-2 text-fg transition-colors hover:border-fg"
    >
      <svg
        viewBox="0 0 100 52"
        className="h-10 w-[76px] shrink-0"
        role="img"
        aria-label={`공포·탐욕 지수 ${value} — ${labelKo}`}
        dangerouslySetInnerHTML={{__html: gauge}}
      />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
          공포 · 탐욕 지수
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tabular-nums leading-none">{value}</span>
          <span className="text-xs font-semibold" style={{color: ZONE_COLORS[zone]}}>
            {labelKo}
          </span>
        </div>
        <div className="text-[9px] text-fg-subtle group-hover:text-fg-muted">
          Data: {source} · 자세히 →
        </div>
      </div>
    </Link>
  );
}
