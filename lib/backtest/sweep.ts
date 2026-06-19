import type {StrategyParam} from "./types";

// 파라미터 민감도 스윕 — 전략 파라미터 1개를 [min,max] 격자로 변화시키며 총수익률을
// 보고, 사용자가 고른 한 점이 "넓은 안정 고원(강건)"인지 "좁은 봉우리(과최적화)"인지
// 진단. 실행(runBacktest N회)은 client 컴포넌트, 여기는 값 샘플링 + 분석 순수함수.
// 룩어헤드는 기존 엔진 그대로라 신규 위험 없음(각 점은 독립 백테스트).

/** 파라미터 [min,max] 를 최대 count 개로 샘플. int 는 정수 격자(범위 작으면 전수),
 * float 는 선형 — step 이 있으면 슬라이더 격자에 스냅(도달 가능 값만). */
export function sweepValues(
  param: Pick<StrategyParam, "min" | "max" | "type" | "step">,
  count = 24
): number[] {
  const {min, max, type} = param;
  if (!(max > min)) return [min];
  if (type === "int") {
    const range = max - min;
    if (range + 1 <= count) {
      const out: number[] = [];
      for (let v = min; v <= max; v++) out.push(v);
      return out;
    }
    const set = new Set<number>();
    for (let i = 0; i < count; i++) {
      set.add(Math.round(min + (range * i) / (count - 1)));
    }
    return [...set].sort((a, b) => a - b);
  }
  // float — step 격자 스냅 (P1-2: 슬라이더로 도달 불가능한 값 노출 방지)
  const step = param.step && param.step > 0 ? param.step : null;
  const set = new Set<number>();
  for (let i = 0; i < count; i++) {
    const raw = min + ((max - min) * i) / (count - 1);
    const v = step
      ? Math.min(max, Math.max(min, Math.round(raw / step) * step))
      : raw;
    set.add(Number(v.toFixed(6))); // float drift 정리
  }
  return [...set].sort((a, b) => a - b);
}

export type SweepPoint = {value: number; pct: number};
export type SweepVerdict = "robust" | "fragile" | "suboptimal" | "flat";

export type SweepAnalysis = {
  bestValue: number;
  bestPct: number;
  worstPct: number;
  currentValue: number;
  currentPct: number;
  /** 총수익률 내림차순 순위 (1 = 최고). */
  currentRank: number;
  total: number;
  verdict: SweepVerdict;
};

/**
 * 스윕 결과 분석. currentValue 는 points 에 포함돼 있어야 함(호출자가 보장).
 * robust=현재값이 상위 + 이웃도 비슷(고원) / fragile=상위지만 이웃 급락(봉우리) /
 * suboptimal=상위 아님(더 나은 구간 존재). 휴리스틱 — 방향성 참고용.
 */
export function analyzeSweep(
  points: SweepPoint[],
  currentValue: number,
  currentPct: number
): SweepAnalysis | null {
  if (points.length < 3) return null;
  const byValue = [...points].sort((a, b) => a.value - b.value);
  // 현재값이 스윕 격자에 없으면(드래그 중 stale 등) 고원/봉우리 판단 불가 — 방어 (P0-1).
  const idx = byValue.findIndex((p) => p.value === currentValue);
  if (idx < 0) return null;

  const byPct = [...points].sort((a, b) => b.pct - a.pct);
  const best = byPct[0];
  const worst = byPct[byPct.length - 1];
  const range = best.pct - worst.pct;
  const currentRank = byPct.filter((p) => p.pct > currentPct).length + 1;

  let verdict: SweepVerdict;
  if (range < 0.5) {
    // 파라미터를 바꿔도 결과 거의 불변 — "강건 고원" 오메시지 방지 (P2-1).
    verdict = "flat";
  } else if (currentPct >= best.pct - Math.max(0.5, range * 0.1)) {
    // 상위(최고 대비 10%/0.5%p 안). 이웃 안정이면 고원, 급락이면 봉우리.
    const neighbors: number[] = [];
    if (idx > 0) neighbors.push(byValue[idx - 1].pct);
    if (idx < byValue.length - 1) neighbors.push(byValue[idx + 1].pct);
    const dropTol = Math.max(1, range * 0.25);
    verdict = neighbors.every((n) => n >= currentPct - dropTol)
      ? "robust"
      : "fragile";
  } else {
    verdict = "suboptimal";
  }

  return {
    bestValue: best.value,
    bestPct: best.pct,
    worstPct: worst.pct,
    currentValue,
    currentPct,
    currentRank,
    total: points.length,
    verdict,
  };
}
