// ADX + DI+/DI- mini chart — 추세 강도 + 방향 시각화.
// ADX line (점선, fg) — 추세 강도. >25 강함, <20 약함.
// DI+ (실선, up color) — 상승 방향 강도
// DI- (실선, down color) — 하락 방향 강도
// 25 reference line + 20 아래 영역 tint (weak trend zone)

type Props = {
  adx: number[];
  plus: number[];
  minus: number[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function AdxMiniChart({
  adx,
  plus,
  minus,
  width = 200,
  height = 56,
  className,
  ariaLabel,
}: Props) {
  if (adx.length < 2 && plus.length < 2 && minus.length < 2) {
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

  const domain: [number, number] = [0, 60]; // ADX 60 이상은 거의 없음 — 0-60 시각 효과적
  const [min, max] = domain;
  const range = max - min;
  const yOf = (v: number) => height - (Math.max(min, Math.min(max, v)) - min) * (height / range);
  const stepX = width / (Math.max(adx.length, plus.length, minus.length) - 1 || 1);
  const xOf = (i: number) => i * stepX;
  const y25 = yOf(25);
  const y20 = yOf(20);

  function pathFor(arr: number[]): string {
    const parts: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      parts.push(`${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(arr[i]).toFixed(2)}`);
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
      {/* weak trend zone (ADX < 20) — neutral tint */}
      <rect
        x={0}
        y={y20}
        width={width}
        height={height - y20}
        fill="var(--fg)"
        fillOpacity={0.04}
      />
      {/* 25 reference (추세 강함 threshold) */}
      <line
        x1={0}
        x2={width}
        y1={y25}
        y2={y25}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      {/* DI- (down color) */}
      {minus.length >= 2 && (
        <path
          d={pathFor(minus)}
          fill="none"
          stroke="var(--color-down)"
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* DI+ (up color) */}
      {plus.length >= 2 && (
        <path
          d={pathFor(plus)}
          fill="none"
          stroke="var(--color-up)"
          strokeWidth={1.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* ADX (점선, fg) — 가장 두꺼움 */}
      {adx.length >= 2 && (
        <path
          d={pathFor(adx)}
          fill="none"
          stroke="var(--fg)"
          strokeWidth={1.75}
          strokeDasharray="4 2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
