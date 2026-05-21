// 변동성 mini chart — line + 평균 reference + last vs avg 색 분기
// ATR/BB Width 같은 임계값 없는 지표용. zone tint 대신 데이터 평균 기반.

type Props = {
  values: number[];
  average?: number; // 명시 안 하면 values 평균
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
};

export function VolatilityMiniChart({
  values,
  average,
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

  const avg = average ?? values.reduce((s, v) => s + v, 0) / values.length;
  const min = Math.min(...values, avg);
  const max = Math.max(...values, avg);
  const pad = (max - min) * 0.1 || 1;
  const domainMin = min - pad;
  const domainMax = max + pad;
  const range = domainMax - domainMin;
  const yOf = (v: number) =>
    height - ((v - domainMin) / range) * height;
  const stepX = width / (values.length - 1 || 1);
  const xOf = (i: number) => i * stepX;
  const yAvg = yOf(avg);

  const last = values[values.length - 1];
  const lineColor =
    last > avg ? "var(--color-down)" : last < avg ? "var(--color-up)" : "var(--fg)";

  let pathD = "";
  for (let i = 0; i < values.length; i++) {
    pathD += `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(2)} ${yOf(values[i]).toFixed(2)} `;
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
      {/* 평균선 (dashed reference) */}
      <line
        x1={0}
        x2={width}
        y1={yAvg}
        y2={yAvg}
        stroke="var(--line)"
        strokeWidth={1}
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
      />
      {/* values line */}
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
