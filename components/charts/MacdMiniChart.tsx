// MACD 시각화 mini chart — RSC 호환 SVG.
// MACD line + signal line + histogram bar + 0 reference line.
// IndicatorPanel 의 MACD 카드에 sparkline 대신 사용 — crossover / divergence 시각 즉시 판단.

type Props = {
  macd: number[];
  signal: number[];
  histogram: number[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function MacdMiniChart({
  macd,
  signal,
  histogram,
  width = 200,
  height = 56,
  className,
  ariaLabel,
}: Props) {
  if (
    macd.length < 2 ||
    signal.length < 2 ||
    histogram.length === 0
  ) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        aria-hidden={ariaLabel ? undefined : "true"}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
      />
    );
  }

  // 모든 값 범위 (macd / signal / histogram 합쳐 동일 y 축).
  let min = Infinity;
  let max = -Infinity;
  for (const v of macd) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  for (const v of signal) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  for (const v of histogram) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  // 0 을 포함시켜 reference line 자연스럽게
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  const range = max - min || 1;

  const n = Math.max(macd.length, signal.length, histogram.length);
  const stepX = width / (n - 1 || 1);
  const yOf = (v: number) => height - ((v - min) / range) * height;
  const xOf = (i: number) => i * stepX;

  // histogram bar — width = stepX * 0.7
  const barW = Math.max(1, stepX * 0.7);
  const yZero = yOf(0);

  function pathFor(values: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const x = xOf(i);
      const y = yOf(values[i]);
      parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return parts.join(" ");
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      aria-hidden={ariaLabel ? undefined : "true"}
    >
      {/* 0 reference line */}
      <line
        x1={0}
        x2={width}
        y1={yZero}
        y2={yZero}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      {/* histogram bars — bullish (>= 0): up color, bearish: down */}
      {histogram.map((v, i) => {
        const x = xOf(i) - barW / 2;
        const y = v >= 0 ? yOf(v) : yZero;
        const h = Math.abs(yOf(v) - yZero);
        const color = v >= 0 ? "var(--color-up)" : "var(--color-down)";
        return (
          <rect
            key={i}
            x={x.toFixed(2)}
            y={y.toFixed(2)}
            width={barW.toFixed(2)}
            height={h.toFixed(2)}
            fill={color}
            fillOpacity={0.35}
          />
        );
      })}
      {/* signal line (점선) */}
      <path
        d={pathFor(signal)}
        fill="none"
        stroke="var(--color-fg-muted)"
        strokeWidth={1.25}
        strokeDasharray="3 2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* MACD line — bull/bear 자동 색 (마지막 값 부호) */}
      <path
        d={pathFor(macd)}
        fill="none"
        stroke={
          macd[macd.length - 1] >= signal[signal.length - 1]
            ? "var(--color-up)"
            : "var(--color-down)"
        }
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
