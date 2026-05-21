// Drawdown chart — underwater area. 0 = ATH (top), 음수 = peak 대비 % 손실.
// 시각: down color fill 8% + stroke 두께 1.5, 0 reference line.
// MDD 지점 marker (작은 원) — 선택적.

type Point = {t: number; v: number}; // v ≤ 0

type Props = {
  points: Point[];
  /** MDD 지점 강조 marker. 미지정 시 자동 (min v). */
  minIndex?: number;
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function DrawdownChart({
  points,
  minIndex,
  width = 800,
  height = 140,
  className,
  ariaLabel,
}: Props) {
  if (points.length < 2) {
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

  const PAD_L = 24; // y 축 라벨 공간
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 8;
  const W = width - PAD_L - PAD_R;
  const H = height - PAD_T - PAD_B;

  // domain
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tRange = tMax - tMin || 1;
  let vMin = 0;
  for (const p of points) if (p.v < vMin) vMin = p.v;
  // y range: [vMin, 0] 일정. vMin = -50% 면 padding 살짝 (-55%).
  const vMinPadded = vMin === 0 ? -1 : vMin * 1.1;
  const vRange = 0 - vMinPadded;

  const xOf = (t: number) => PAD_L + ((t - tMin) / tRange) * W;
  const yOf = (v: number) => PAD_T + ((0 - v) / vRange) * H; // 0 → top, v < 0 → 아래

  // line path
  const lineParts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    lineParts.push(`${i === 0 ? "M" : "L"} ${xOf(p.t).toFixed(2)} ${yOf(p.v).toFixed(2)}`);
  }
  const lineD = lineParts.join(" ");

  // area path (0 baseline 으로 채움)
  const areaParts: string[] = [];
  areaParts.push(`M ${xOf(points[0].t).toFixed(2)} ${yOf(0).toFixed(2)}`);
  for (const p of points) {
    areaParts.push(`L ${xOf(p.t).toFixed(2)} ${yOf(p.v).toFixed(2)}`);
  }
  areaParts.push(
    `L ${xOf(points[points.length - 1].t).toFixed(2)} ${yOf(0).toFixed(2)} Z`
  );
  const areaD = areaParts.join(" ");

  // MDD marker
  const mIdx =
    minIndex !== undefined
      ? minIndex
      : points.reduce(
          (acc, p, i) => (p.v < points[acc].v ? i : acc),
          0
        );
  const minPoint = points[mIdx];

  // y 축 라벨 — 0 / midpoint / vMinPadded
  const yLabels: Array<{v: number; y: number}> = [
    {v: 0, y: yOf(0)},
    {v: vMinPadded / 2, y: yOf(vMinPadded / 2)},
    {v: vMinPadded, y: yOf(vMinPadded)},
  ];

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
      {/* 0 reference (top) */}
      <line
        x1={PAD_L}
        x2={width - PAD_R}
        y1={yOf(0)}
        y2={yOf(0)}
        stroke="var(--line)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {/* y 축 라벨 */}
      {yLabels.map((l) => (
        <text
          key={l.v}
          x={PAD_L - 4}
          y={l.y + 3}
          textAnchor="end"
          fontSize="9"
          fill="var(--fg-subtle)"
        >
          {l.v.toFixed(0)}%
        </text>
      ))}
      {/* area fill */}
      <path
        d={areaD}
        fill="var(--color-down)"
        fillOpacity={0.12}
        stroke="none"
      />
      {/* line */}
      <path
        d={lineD}
        fill="none"
        stroke="var(--color-down)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* MDD marker */}
      <circle
        cx={xOf(minPoint.t)}
        cy={yOf(minPoint.v)}
        r={3}
        fill="var(--color-down)"
        stroke="var(--bg)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
