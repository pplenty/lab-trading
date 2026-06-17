import {describe, expect, it} from "vitest";
import {compositeRiskMetrics} from "./composite-index";
import {mddPct} from "@/lib/backtest/metrics";

describe("compositeRiskMetrics", () => {
  it("MDD 는 백테스트 mddPct 와 동일 (apples-to-apples)", () => {
    const vals = [100, 120, 90, 110];
    const r = compositeRiskMetrics(vals);
    expect(r.mddPct).toBeCloseTo(mddPct(vals), 9);
    // peak 120 → trough 90 = 25%
    expect(r.mddPct).toBeCloseTo(25, 6);
  });

  it("단조 상승이면 MDD 0, 변동성은 양수", () => {
    const r = compositeRiskMetrics([100, 101, 102, 103]);
    expect(r.mddPct).toBe(0);
    expect(r.volatilityPct).toBeGreaterThan(0);
  });

  it("변동성 0 — 수익률이 모두 동일(일정 비율)", () => {
    // 매 봉 +10% → 일간 수익률 분산 0 → 변동성 0
    const r = compositeRiskMetrics([100, 110, 121, 133.1]);
    expect(r.volatilityPct).toBeCloseTo(0, 9);
  });

  it("변동성은 출렁일수록 큼", () => {
    const calm = compositeRiskMetrics([100, 101, 100, 101, 100]);
    const wild = compositeRiskMetrics([100, 130, 80, 140, 70]);
    expect(wild.volatilityPct).toBeGreaterThan(calm.volatilityPct);
  });

  it("2점 미만 → 0", () => {
    expect(compositeRiskMetrics([100])).toEqual({mddPct: 0, volatilityPct: 0});
    expect(compositeRiskMetrics([])).toEqual({mddPct: 0, volatilityPct: 0});
  });
});
