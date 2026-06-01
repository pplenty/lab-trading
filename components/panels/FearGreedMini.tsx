import {Link} from "@/i18n/navigation";
import type {FearGreedReading} from "@/lib/market/fear-greed";
import {buildGaugeInner, ZONE_COLORS} from "@/lib/market/gauge";

// 대시보드용 컴팩트 공포·탐욕 미니 게이지. 코인 + 미국 2종을 한 줄 카드로.
// 카드 전체가 /market 링크 → 내부에 <a> 중첩 불가하므로 출처는 plain text
// (alternative.me ToS: 값 옆 출처 표기면 충족, 링크 의무 아님). 추가 JS 0 (RSC SVG).

function MiniGauge({
  reading,
  marketLabel,
}: {
  reading: FearGreedReading | null;
  marketLabel: string;
}) {
  if (!reading) {
    return (
      <div className="flex flex-col items-center justify-center py-2 text-center">
        <span className="text-xs font-medium text-fg-muted">{marketLabel}</span>
        <span className="mt-1 text-[10px] text-fg-subtle">데이터 준비 중</span>
      </div>
    );
  }
  const {value, zone, labelKo, source} = reading;
  const gauge = buildGaugeInner({
    cx: 70,
    cy: 64,
    r: 52,
    strokeWidth: 11,
    value,
    needleColor: "currentColor",
  });
  return (
    <div className="flex flex-col items-center text-fg">
      <span className="text-[11px] font-medium text-fg-muted">{marketLabel}</span>
      <svg
        viewBox="0 0 140 74"
        className="mt-0.5 h-[58px] w-[112px]"
        role="img"
        aria-label={`${marketLabel} 공포·탐욕 지수 ${value} — ${labelKo}`}
        dangerouslySetInnerHTML={{__html: gauge}}
      />
      <div className="-mt-1.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums leading-none text-fg">
          {value}
        </span>
        <span className="text-xs font-semibold" style={{color: ZONE_COLORS[zone]}}>
          {labelKo}
        </span>
      </div>
      <span className="mt-1 text-[9px] text-fg-subtle">Data: {source}</span>
    </div>
  );
}

export function FearGreedMini({
  crypto,
  us,
}: {
  crypto: FearGreedReading | null;
  us: FearGreedReading | null;
}) {
  return (
    <Link
      href="/market"
      className="group block rounded-lg border border-line bg-surface/30 p-4 transition-colors hover:border-fg"
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg group-hover:text-accent">
          🌡️ 공포 · 탐욕 지수
        </h3>
        <span className="text-[11px] text-fg-subtle group-hover:text-fg">
          자세히 →
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 divide-x divide-line">
        <MiniGauge reading={crypto} marketLabel="코인" />
        <MiniGauge reading={us} marketLabel="미국 증시" />
      </div>
    </Link>
  );
}
