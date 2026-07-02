// 거래비용 민감도 — 수수료·슬리피지를 함께 0×~3× 배율로 바꿔 같은 전략을 재실행,
// 단순 보유(비용 0 baseline, ResultCard 의 outperformance 기준과 동일) 대비 우위(edge)가
// 어느 비용 수준까지 살아남는지 진단. 신호는 비용과 무관(onBar 는 cash 를 안 봄) →
// 거래 목록 동일, equity 만 변화 — 배율 증가에 따라 성과 단조 감소.
// 실행(runBacktest)은 component, 여기는 순수 분석. 스윕(파라미터)·walk-forward(미래
// 일반화)에 이은 강건성 3번째 축.

export const COST_MULTIPLES = [0, 0.5, 1, 1.5, 2, 3] as const;

/** ±0.01%p 는 우위로 안 침 — ResultCard outperformance 중립대와 동일 (verdict 정합). */
const EDGE_NEUTRAL_PP = 0.01;

export type CostPoint = {
  /** 기본 수수료·슬리피지 대비 배율. 1 = 현재 설정. */
  multiple: number;
  /** 해당 비용에서의 전략 총수익률 (%). */
  pct: number;
  /** 체결(fill) 횟수 = trades.length. 비용은 체결마다 발생하므로 round-trip
   * tradeCount 가 아닌 fill 수가 기준 (buy-and-hold 는 round-trip 0 이지만 fill 1). */
  fills: number;
};

export type CostVerdict =
  | "robust" // 최대 배율에서도 단순 보유 대비 우위 유지
  | "moderate" // 손익분기 배율 ≥ 2×
  | "thin" // 손익분기 배율 1×~2× — 비용 여유 얇음
  | "cost-eaten" // 무비용(0×)이면 우위인데 현재(1×) 비용이 지움
  | "no-edge"; // 비용과 무관하게 우위 없음

export type CostSensitivity = {
  /** 배율 오름차순 정렬. */
  points: CostPoint[];
  /** 단순 보유 수익률 (%) — 우위(edge) 기준선. 비용 배율과 무관. */
  buyHoldPct: number;
  /** 무비용(0×)에서의 우위 (%p) — 신호 자체의 우위. */
  edgeAt0xPp: number;
  /** 현재(1×) 비용에서의 우위 (%p). */
  edgeAt1xPp: number;
  /** pct(0×) - pct(1×) — 현재 비용이 갉아먹는 드래그 (%p). */
  costDragPp: number;
  /** 우위가 0 이 되는 비용 배율 (인접 격자 선형보간). null = 격자 끝까지 우위 유지
   * 또는 우위였던 적 없음(no-edge). */
  breakEvenMultiple: number | null;
  /** 체결 횟수 (1× 기준 — 신호는 비용과 무관하므로 배율 불변). */
  fills: number;
  verdict: CostVerdict;
};

/**
 * 배율별 재실행 결과를 판정. points 에 0× 와 1× 가 없으면 null (분석 불능).
 * fills 는 신호 불변이므로 1× 값 사용 — 0체결 처리는 caller 몫 (패널 noTrades).
 */
export function analyzeCostSensitivity(
  points: CostPoint[],
  buyHoldPct: number
): CostSensitivity | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.multiple - b.multiple);
  const at0 = sorted.find((p) => p.multiple === 0);
  const at1 = sorted.find((p) => p.multiple === 1);
  if (!at0 || !at1) return null;

  const edge = (p: CostPoint) => p.pct - buyHoldPct;
  const e0 = edge(at0);
  const e1 = edge(at1);
  const eLast = edge(sorted[sorted.length - 1]);
  const breakEvenMultiple = firstBreakEven(sorted, buyHoldPct);

  let verdict: CostVerdict;
  if (e1 > EDGE_NEUTRAL_PP) {
    if (eLast > 0) verdict = "robust";
    else if (breakEvenMultiple !== null && breakEvenMultiple >= 2)
      verdict = "moderate";
    else verdict = "thin";
  } else {
    verdict = e0 > EDGE_NEUTRAL_PP ? "cost-eaten" : "no-edge";
  }

  return {
    points: sorted,
    buyHoldPct,
    edgeAt0xPp: e0,
    edgeAt1xPp: e1,
    costDragPp: at0.pct - at1.pct,
    breakEvenMultiple,
    fills: at1.fills,
    verdict,
  };
}

/** 인접 격자에서 우위가 +→0 이하로 처음 넘어가는 배율 (선형보간). 없으면 null. */
function firstBreakEven(
  sorted: CostPoint[],
  buyHoldPct: number
): number | null {
  for (let i = 1; i < sorted.length; i++) {
    const ePrev = sorted[i - 1].pct - buyHoldPct;
    const eCur = sorted[i].pct - buyHoldPct;
    if (ePrev > 0 && eCur <= 0) {
      // denom = ePrev - eCur ≥ ePrev > 0 — 이 분기에선 0 나눗셈 불가.
      const denom = ePrev - eCur;
      return (
        sorted[i - 1].multiple +
        (sorted[i].multiple - sorted[i - 1].multiple) * (ePrev / denom)
      );
    }
  }
  return null;
}
