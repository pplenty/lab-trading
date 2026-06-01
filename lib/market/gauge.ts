// 공포·탐욕 게이지의 순수 SVG 기하 — 위젯(FearGreedGauge)과 OG 카드(buildFearGreedOgSvg)가
// 동일 markup 을 공유한다. 라이브러리 없이 반원형(180°) 5-zone 게이지 + 바늘.
//
// 좌표 규칙: 표준 수학 각도(0°=오른쪽 +x, 90°=위). SVG 는 y 가 아래로 자라므로
//   point = (cx + r·cosθ, cy - r·sinθ) 로 위쪽 반원을 그린다.
// 의미 축: 왼쪽(180°) = 극단적 공포 → 오른쪽(0°) = 극단적 탐욕.
//   value 0  → 바늘 왼쪽(180°),  value 100 → 바늘 오른쪽(0°),  value 50 → 정상(90°).

export type FearGreedZone = 0 | 1 | 2 | 3 | 4; // 극단적 공포 → 극단적 탐욕

/** 5-zone 색 (좌=공포 빨강 → 우=탐욕 초록). price up/down 토큰과 별개 — 지수 자체 의미축. */
export const ZONE_COLORS = ["#dc2626", "#f97316", "#eab308", "#84cc16", "#16a34a"];
export const ZONE_LABELS_KO = ["극단적 공포", "공포", "중립", "탐욕", "극단적 탐욕"];
export const ZONE_LABELS_EN = [
  "Extreme Fear",
  "Fear",
  "Neutral",
  "Greed",
  "Extreme Greed",
];

/** value(0-100) → zone. alternative.me 경계(0-24 / 25-44 / 45-55 / 56-75 / 76-100) 준용. */
export function zoneFromValue(value: number): FearGreedZone {
  const v = Math.max(0, Math.min(100, value));
  if (v < 25) return 0;
  if (v < 45) return 1;
  if (v <= 55) return 2;
  if (v <= 75) return 3;
  return 4;
}

/** alternative.me value_classification 문자열 → zone (API 분류를 신뢰, 미스매치 시 value 폴백). */
export function zoneFromClassification(
  classification: string,
  value: number
): FearGreedZone {
  const s = classification.toLowerCase();
  if (s.includes("extreme") && s.includes("fear")) return 0;
  if (s.includes("extreme") && s.includes("greed")) return 4;
  if (s.includes("neutral")) return 2;
  if (s.includes("fear")) return 1;
  if (s.includes("greed")) return 3;
  return zoneFromValue(value);
}

/** value(0-100) → 바늘 각도(표준 수학 도). 0→180(좌), 100→0(우), 50→90(상). */
export function needleAngleDeg(value: number): number {
  const v = Math.max(0, Math.min(100, value));
  return 180 - (v / 100) * 180;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return {x: cx + r * Math.cos(a), y: cy - r * Math.sin(a)};
}

/** a0 > a1 (좌→우, 위쪽 호) 의 SVG arc path d. 각 segment < 180° 이므로 large-arc=0, sweep=1. */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number
): string {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(
    2
  )} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export type GaugeGeometryOpts = {
  cx: number;
  cy: number;
  r: number; // zone 호 반지름 (호 중심선)
  strokeWidth: number;
  value: number; // 0-100
  /** 바늘 색 (기본 진한 fg). */
  needleColor?: string;
  /** 비활성 zone 투명도 (기본 1 — 전부 칠함). */
  trackOpacity?: number;
};

/**
 * 게이지 내부 markup(<svg> 래퍼 없음) 반환 — 5 zone 호 + 바늘 + 허브.
 * 위젯은 <svg> 안에 dangerouslySetInnerHTML 로, OG 카드는 문자열 연결로 사용.
 */
export function buildGaugeInner(opts: GaugeGeometryOpts): string {
  const {cx, cy, r, strokeWidth, value} = opts;
  const needleColor = opts.needleColor ?? "#0f172a";
  const opacity = opts.trackOpacity ?? 1;
  const active = zoneFromValue(value);

  const arcs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a0 = 180 - i * 36;
    const a1 = 180 - (i + 1) * 36;
    // 활성 zone 은 불투명, 나머지는 trackOpacity (단조로움 방지 + 현재 구간 강조)
    const op = i === active ? 1 : opacity;
    arcs.push(
      `<path d="${arcPath(cx, cy, r, a0, a1)}" stroke="${ZONE_COLORS[i]}" ` +
        `stroke-width="${strokeWidth}" fill="none" stroke-linecap="butt" opacity="${op}"/>`
    );
  }

  // 바늘 — 허브에서 호 안쪽까지
  const tip = polar(cx, cy, r - strokeWidth * 0.15, needleAngleDeg(value));
  const hubR = Math.max(5, strokeWidth * 0.42);
  const needle =
    `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${tip.x.toFixed(
      2
    )}" y2="${tip.y.toFixed(2)}" stroke="${needleColor}" ` +
    `stroke-width="${Math.max(3, strokeWidth * 0.18).toFixed(
      1
    )}" stroke-linecap="round"/>` +
    `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${hubR.toFixed(
      1
    )}" fill="${needleColor}"/>`;

  return arcs.join("\n  ") + "\n  " + needle;
}
