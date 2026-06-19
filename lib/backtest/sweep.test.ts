import {describe, expect, it} from "vitest";
import {sweepValues, analyzeSweep, type SweepPoint} from "./sweep";

describe("sweepValues", () => {
  it("int 범위가 작으면 전수 정수 열거", () => {
    expect(sweepValues({min: 2, max: 8, type: "int"}, 24)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("int 범위가 크면 균등 샘플 (count 이하, 정수, 정렬, dedup)", () => {
    const vals = sweepValues({min: 2, max: 200, type: "int"}, 24);
    expect(vals.length).toBeLessThanOrEqual(24);
    expect(vals[0]).toBe(2);
    expect(vals[vals.length - 1]).toBe(200);
    expect(vals).toEqual([...vals].sort((a, b) => a - b));
    expect(new Set(vals).size).toBe(vals.length); // dedup
    expect(vals.every((v) => Number.isInteger(v))).toBe(true);
  });

  it("float 는 선형 count 개", () => {
    const vals = sweepValues({min: 0, max: 1, type: "float"}, 5);
    expect(vals).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it("min>=max 방어", () => {
    expect(sweepValues({min: 5, max: 5, type: "int"}, 10)).toEqual([5]);
  });

  it("float step 격자 스냅 — 슬라이더 도달 가능 값만 (P1-2)", () => {
    const vals = sweepValues({min: 1, max: 4, type: "float", step: 0.5}, 24);
    expect(vals.every((v) => Math.round(v * 2) === v * 2)).toBe(true); // 0.5 격자
    expect(vals[0]).toBe(1);
    expect(vals[vals.length - 1]).toBe(4);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

describe("analyzeSweep", () => {
  const pt = (value: number, pct: number): SweepPoint => ({value, pct});

  it("현재값이 최고 + 이웃도 비슷 → robust (고원)", () => {
    const points = [pt(10, 18), pt(20, 19), pt(30, 20), pt(40, 19), pt(50, 18)];
    const a = analyzeSweep(points, 30, 20)!;
    expect(a.verdict).toBe("robust");
    expect(a.bestValue).toBe(30);
    expect(a.currentRank).toBe(1);
  });

  it("현재값이 최고지만 이웃 급락 → fragile (봉우리/과최적화)", () => {
    const points = [pt(10, 2), pt(20, 1), pt(30, 40), pt(40, 0), pt(50, -3)];
    const a = analyzeSweep(points, 30, 40)!;
    expect(a.verdict).toBe("fragile");
    expect(a.bestValue).toBe(30);
  });

  it("현재값이 상위 아님 → suboptimal + best 지목", () => {
    const points = [pt(10, 5), pt(20, 30), pt(30, 8), pt(40, 6), pt(50, 4)];
    const a = analyzeSweep(points, 30, 8)!;
    expect(a.verdict).toBe("suboptimal");
    expect(a.bestValue).toBe(20);
    expect(a.bestPct).toBe(30);
    expect(a.currentRank).toBeGreaterThan(1);
  });

  it("점 3개 미만 → null", () => {
    expect(analyzeSweep([pt(1, 1), pt(2, 2)], 1, 1)).toBeNull();
  });

  it("현재값이 스윕 격자에 없으면 null (idx<0 방어, P0-1)", () => {
    const points = [pt(10, 5), pt(20, 5), pt(30, 5)];
    expect(analyzeSweep(points, 99, 40)).toBeNull(); // 99 는 points 에 없음
  });

  it("range 가 거의 0 이면 flat (파라미터 무영향, P2-1)", () => {
    const points = [pt(10, 12), pt(20, 12), pt(30, 12.2)];
    const a = analyzeSweep(points, 20, 12)!;
    expect(a.verdict).toBe("flat");
  });

  it("currentRank 는 총수익 내림차순 순위", () => {
    const points = [pt(10, 10), pt(20, 30), pt(30, 20), pt(40, 5)];
    expect(analyzeSweep(points, 30, 20)!.currentRank).toBe(2); // 30 보다 큰 건 1개(30→2위)
  });
});
