type Props = {
  size?: number;
  className?: string;
};

// 사이트 brand mark — favicon 과 동일 디자인. 헤더 wordmark 옆에 작은 사이즈로.
// currentColor 사용 — 부모 text 색에 자동 매칭 (light/dark mode).
// 끝점 별만 down color (한국식 상승색) 으로 고정 — 액센트 유지.
export function BrandMark({size = 18, className}: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth={0.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      >
        <path d="M 3 18 L 7 15 L 11 12 L 15 8 L 19 4" />
        <path d="M 7 15 L 9 19" />
        <path d="M 15 8 L 13 12" />
      </g>
      <g fill="currentColor">
        <circle cx="3" cy="18" r="1" />
        <circle cx="7" cy="15" r="0.8" />
        <circle cx="11" cy="12" r="1.2" />
        <circle cx="15" cy="8" r="0.8" />
        <circle cx="9" cy="19" r="0.6" />
        <circle cx="13" cy="12" r="0.6" />
      </g>
      <circle cx="19" cy="4" r="1.8" fill="var(--color-up)" />
    </svg>
  );
}
