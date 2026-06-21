import {describe, expect, it} from "vitest";
import {
  splitISOOS,
  selectISBest,
  walkForwardVerdict,
} from "./walk-forward";
import type {Candle} from "@/lib/types";
import type {StrategyParam} from "./types";

const day = 86400;
function candles(n: number): Candle[] {
  return Array.from({length: n}, (_, i) => ({
    t: (i + 1) * day,
    o: 100,
    h: 100,
    l: 100,
    c: 100,
    v: 0,
  }));
}

describe("splitISOOS", () => {
  it("70/30 분할 — IS 마지막 t < OOS 첫 t (룩어헤드 없음)", () => {
    const cs = candles(100);
    const s = splitISOOS(cs, 0.3, 30)!;
    expect(s.isBars).toBe(70);
    expect(s.oosBars).toBe(30);
    expect(s.boundaryIdx).toBe(70);
    expect(s.boundaryT).toBe(cs[70].t); // OOS 첫 봉
    // 인덱스 슬라이스: IS=slice(0,70) 30..69, OOS=slice(70) 70..99
    expect(cs.slice(0, s.boundaryIdx).length).toBe(70);
    expect(cs.slice(s.boundaryIdx).length).toBe(30);
    // IS 는 c.t < boundaryT (index 0..69), OOS 는 c.t >= boundaryT (index 70..99)
    expect(cs[69].t).toBeLessThan(s.boundaryT);
    expect(cs[70].t).toBe(s.boundaryT);
  });

  it("양쪽 최소 봉 미만이면 null", () => {
    expect(splitISOOS(candles(50), 0.3, 30)).toBeNull(); // 35/15 → OOS<30
    expect(splitISOOS(candles(40), 0.3, 30)).toBeNull(); // 28 IS < 30
    expect(splitISOOS(candles(10), 0.3, 30)).toBeNull();
  });
});

describe("selectISBest", () => {
  const param: StrategyParam = {
    key: "p",
    label: "P",
    labelKo: "피",
    type: "int",
    min: 2,
    max: 10,
    default: 5,
  };
  it("격자 중 IS 총수익 최고 값 선택 (거래 있는 후보 중)", () => {
    const run = (params: Record<string, number>) =>
      params.p === 7 ? {pct: 40, trades: 3} : {pct: params.p * 2, trades: 2};
    const best = selectISBest(param, {p: 5}, run)!;
    expect(best.value).toBe(7);
    expect(best.isPct).toBe(40);
    expect(best.isTrades).toBe(3);
  });
  it("IS 무거래(trades<1) 값은 제외 (단일 행운 거래 봉우리 완화)", () => {
    // p=7 이 pct 최고지만 거래 0 → 제외 → 거래 있는 다른 값 선택
    const run = (params: Record<string, number>) =>
      params.p === 7 ? {pct: 99, trades: 0} : {pct: 5, trades: 2};
    const best = selectISBest(param, {p: 5}, run)!;
    expect(best.value).not.toBe(7);
    expect(best.isPct).toBe(5);
  });
  it("invalid(null)·전부 무거래 → null", () => {
    expect(selectISBest(param, {p: 5}, () => null)).toBeNull();
    expect(
      selectISBest(param, {p: 5}, () => ({pct: 10, trades: 0}))
    ).toBeNull();
  });
});

describe("walkForwardVerdict", () => {
  it("OOS 무거래 → inconclusive (과최적화 아님 — 워밍업/신호 부재)", () => {
    expect(walkForwardVerdict(40, 0, 0)).toBe("inconclusive");
    expect(walkForwardVerdict(40, -5, 0)).toBe("inconclusive");
  });
  it("OOS 가 IS-best 절반 이상 + 양수 → robust", () => {
    expect(walkForwardVerdict(40, 25, 5)).toBe("robust");
    expect(walkForwardVerdict(40, 20, 5)).toBe("robust"); // ratio 0.5 경계
  });
  it("OOS 음수 또는 IS 20% 미만 (거래 있음) → overfit-suspect", () => {
    expect(walkForwardVerdict(40, -10, 3)).toBe("overfit-suspect");
    expect(walkForwardVerdict(40, 5, 4)).toBe("overfit-suspect"); // ratio 0.125
  });
  it("중간(20~50%) → inconclusive", () => {
    expect(walkForwardVerdict(40, 12, 3)).toBe("inconclusive"); // ratio 0.3
  });
  it("IS-best 자체가 미미(<=1%) → inconclusive", () => {
    expect(walkForwardVerdict(0.5, 5, 2)).toBe("inconclusive");
    expect(walkForwardVerdict(-10, -2, 2)).toBe("inconclusive");
  });
});
