// 0~100 oscillator (RSI / Stochastic 등) mini chart — RSC 호환 SVG.
// 두 reference line (lower/upper) + 영역 tint (oversold/overbought) + primary line + 선택적 secondary line.
// MacdMiniChart 와 동일 시각 언어.

type Props = {
  values: number[];
  /** 선택적 두 번째 라인 (예: Stochastic %D). */
  secondary?: number[];
  /** 영역 분할 reference (예: RSI 30, Stoch 20). */
  lower: number;
  /** 상단 영역 (예: RSI 70, Stoch 80). */
  upper: number;
  /** [min, max] — 보통 [0, 100]. */
  domain?: [number, number];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function OscillatorMiniChart({
  values,
  secondary,
  lower,
  upper,
  domain = [0, 100],
  width = 200,
  height = 56,
  className,
  ariaLabel,
}: Props) {
  if (values.length < 2) {
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

  const [min, max] = domain;
  const range = max - min || 1;
  const yOf = (v: number) => height - ((v - min) / range) * height;
  const stepX = width / (values.length - 1);
  const xOf = (i: number) => i * stepX;

  const yLower = yOf(lower);
  const yUpper = yOf(upper);

  function pathFor(arr: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const x = xOf(i);
      const y = yOf(arr[i]);
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
      {/* oversold zone (lower 아래) — up color tint (반등 잠재력) */}
      <rect
        x={0}
        y={yLower}
        width={width}
        height={height - yLower}
        fill="var(--color-up)"
        fillOpacity={0.08}
      />
      {/* overbought zone (upper 위) — down color tint */}
      <rect
        x={0}
        y={0}
        width={width}
        height={yUpper}
        fill="var(--color-down)"
        fillOpacity={0.08}
      />
      {/* reference lines */}
      <line
        x1={0}
        x2={width}
        y1={yLower}
        y2={yLower}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        x2={width}
        y1={yUpper}
        y2={yUpper}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      {/* secondary line (점선, fg-muted) */}
      {secondary && secondary.length >= 2 && (
        <path
          d={pathFor(secondary)}
          fill="none"
          stroke="var(--color-fg-muted)"
          strokeWidth={1.25}
          strokeDasharray="3 2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* primary line — 마지막 값이 lower 아래 = up (반등 기대), upper 위 = down (조정 기대), 중간 = neutral */}
      <path
        d={pathFor(values)}
        fill="none"
        stroke={(() => {
          const last = values[values.length - 1];
          if (last <= lower) return "var(--color-up)";
          if (last >= upper) return "var(--color-down)";
          return "var(--fg)";
        })()}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
