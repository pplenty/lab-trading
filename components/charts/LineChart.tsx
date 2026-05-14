// 자체 SVG line chart — 백테스트 equity curve 등 단순 시계열.
// RSC 호환 (no "use client") — props 가 정해지면 결정론적 렌더.
// 화살표 / tooltip 없이 path 만. 인터랙션이 필요하면 lightweight-charts wrapper 별도.

export type LineSeries = {
  /** 표시 라벨 (legend). */
  label: string;
  /** [{t, v}] — t 는 unix sec 또는 단순 index. */
  points: Array<{t: number; v: number}>;
  /** CSS 변수 (`--color-up`) 또는 hex. */
  color: string;
  /** dasharray (legend "비교 baseline" 등 점선 표기 시). */
  dashed?: boolean;
};

type Props = {
  series: LineSeries[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function LineChart({
  series,
  width = 800,
  height = 240,
  className,
  ariaLabel,
}: Props) {
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 8;
  const W = width - PAD_L - PAD_R;
  const H = height - PAD_T - PAD_B;

  // 모든 series 합쳐 t 범위와 v 범위 계산.
  let tMin = Infinity;
  let tMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.t < tMin) tMin = p.t;
      if (p.t > tMax) tMax = p.t;
      if (p.v < vMin) vMin = p.v;
      if (p.v > vMax) vMax = p.v;
    }
  }
  if (!isFinite(tMin) || !isFinite(vMin) || tMax === tMin || vMax === vMin) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
      />
    );
  }

  const tRange = tMax - tMin;
  const vRange = vMax - vMin;

  function pathFor(points: Array<{t: number; v: number}>): string {
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = PAD_L + ((p.t - tMin) / tRange) * W;
      const y = PAD_T + H - ((p.v - vMin) / vRange) * H;
      parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return parts.join(" ");
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      <rect
        x={PAD_L}
        y={PAD_T}
        width={W}
        height={H}
        fill="none"
        stroke="var(--line)"
        strokeWidth={1}
      />
      {series.map((s, idx) => (
        <path
          key={`${s.label}-${idx}`}
          d={pathFor(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={s.dashed ? "4 3" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
