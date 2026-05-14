// 가벼운 SVG sparkline — RSC 호환 ( "use client" 없음 ).
// 200 봉 까지 viewBox 80×32 영역에 그려서 카드 그리드 / 랭킹 테이블 등에 inline 사용.
// 색은 시작 → 끝 변화에 따라 --color-up / --color-down (컨벤션 I).
// 화살표·부호는 별도 컴포넌트가 노출. Sparkline 은 추세 시각 큐만 담당.

type Props = {
  values: number[];
  width?: number;
  height?: number;
  /** 명시적 색 사용 시. 미지정 시 시작 → 끝 비교로 자동. */
  color?: "up" | "down" | "neutral";
  className?: string;
  /** 화면판독기용 텍스트. */
  ariaLabel?: string;
};

export function Sparkline({
  values,
  width = 80,
  height = 32,
  color,
  className,
  ariaLabel,
}: Props) {
  if (!values || values.length < 2) {
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

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  // y 는 위가 0 — 가격이 클수록 위로 (y 감소).
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const auto: "up" | "down" | "neutral" =
    values[values.length - 1] > values[0]
      ? "up"
      : values[values.length - 1] < values[0]
      ? "down"
      : "neutral";
  const useColor = color ?? auto;
  const stroke =
    useColor === "up"
      ? "var(--color-up)"
      : useColor === "down"
      ? "var(--color-down)"
      : "var(--color-fg-muted)";

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
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
