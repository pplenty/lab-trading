import type {FngHistoryPoint} from "@/lib/market/fear-greed";
import {ZONE_COLORS, ZONE_LABELS_KO, zoneFromValue} from "@/lib/market/gauge";

// 공포·탐욕 지수 히스토리 라인 차트 (RSC SVG). 5-zone 배경 밴드(공포 빨강↓ → 탐욕 초록↑) + 값 라인.
// 추가 클라이언트 JS 0. lib/market/gauge 색 공유.

const W = 320;
const H = 96;
const PAD_T = 4;
const PAD_B = 4;
const PLOT_H = H - PAD_T - PAD_B;

export function FearGreedHistoryChart({
  points,
  market,
}: {
  points: FngHistoryPoint[];
  market: string;
}) {
  if (points.length < 2) return null;
  const n = points.length;
  const xAt = (i: number) => (i / (n - 1)) * W;
  const yAt = (v: number) =>
    PAD_T + PLOT_H - (Math.max(0, Math.min(100, v)) / 100) * PLOT_H;

  const path =
    "M " + points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" L ");

  const last = points[n - 1].value;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lastColor = ZONE_COLORS[zoneFromValue(last)];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${market} 공포·탐욕 지수 ${points.length}일 추이 — 현재 ${last}, 최저 ${min}, 최고 ${max}`}
      >
        {/* 5-zone 배경 밴드 (각 20 단위) */}
        {ZONE_COLORS.map((c, i) => {
          const yTop = PAD_T + PLOT_H - (((i + 1) * 20) / 100) * PLOT_H;
          const h = (20 / 100) * PLOT_H;
          return (
            <rect
              key={i}
              x={0}
              y={yTop}
              width={W}
              height={h}
              fill={c}
              opacity={0.1}
            />
          );
        })}
        {/* 중립(50) 기준선 */}
        <line
          x1={0}
          y1={yAt(50)}
          x2={W}
          y2={yAt(50)}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeDasharray="3 3"
        />
        {/* 값 라인 */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* 마지막 점 */}
        <circle cx={xAt(n - 1)} cy={yAt(last)} r={3} fill={lastColor} />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-fg-subtle">
        <span>{points.length}일 추이</span>
        <span className="tabular-nums">
          최저 <span style={{color: ZONE_COLORS[zoneFromValue(min)]}}>{min}</span> · 최고{" "}
          <span style={{color: ZONE_COLORS[zoneFromValue(max)]}}>{max}</span> · 현재{" "}
          <span style={{color: lastColor}}>
            {last} {ZONE_LABELS_KO[zoneFromValue(last)]}
          </span>
        </span>
      </div>
    </div>
  );
}
