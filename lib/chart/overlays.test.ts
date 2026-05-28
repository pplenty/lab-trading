import {describe, expect, it} from "vitest";
import type {Candle, IndicatorRow} from "@/lib/types";
import {buildVwapOverlay, buildSupertrendOverlays} from "./overlays";

const DAY = 86400;

function mk(prices: number[], vol = 100): Candle[] {
  return prices.map((p, i) => ({
    t: i * DAY,
    o: p,
    h: p,
    l: p,
    c: p,
    v: vol,
  }));
}

describe("buildVwapOverlay (anchored)", () => {
  it("동일 volume + 일정 가격 → vwap = 가격", () => {
    const candles = mk([100, 100, 100, 100]);
    const ov = buildVwapOverlay(candles);
    expect(ov.id).toBe("vwap");
    expect(ov.points.length).toBe(4);
    for (const p of ov.points) {
      expect(p.v).toBe(100);
    }
  });

  it("상승 시리즈 — vwap 누적 평균 (현재가 < vwap)", () => {
    const candles = mk([100, 110, 120, 130]);
    const ov = buildVwapOverlay(candles);
    // anchored: 첫 봉 vwap = 100
    expect(ov.points[0].v).toBe(100);
    // 두 번째: (100+110)/2 = 105
    expect(ov.points[1].v).toBeCloseTo(105, 5);
    // 마지막: (100+110+120+130)/4 = 115
    expect(ov.points[3].v).toBeCloseTo(115, 5);
  });

  it("volume 0 봉 — vwap 누적 불변", () => {
    const candles: Candle[] = [
      {t: 0, o: 100, h: 100, l: 100, c: 100, v: 100},
      {t: DAY, o: 200, h: 200, l: 200, c: 200, v: 0}, // 무시
      {t: 2 * DAY, o: 110, h: 110, l: 110, c: 110, v: 100},
    ];
    const ov = buildVwapOverlay(candles);
    expect(ov.points[0].v).toBe(100);
    expect(ov.points[1].v).toBe(100); // volume 0 → 누적 불변
    // (100*100 + 110*100) / 200 = 105
    expect(ov.points[2].v).toBeCloseTo(105, 5);
  });

  it("typical price 사용 (h+l+c)/3", () => {
    const candles: Candle[] = [
      {t: 0, o: 100, h: 120, l: 80, c: 100, v: 100},
    ];
    const ov = buildVwapOverlay(candles);
    // typical = (120+80+100)/3 = 100
    expect(ov.points[0].v).toBeCloseTo(100, 5);
  });
});

describe("buildSupertrendOverlays", () => {
  const row = (atr: number): IndicatorRow =>
    ({t: 0, computed_version: 2, atr_14: atr}) as IndicatorRow;

  it("두 series (up/down) 반환, 각 봉은 한쪽만 값 보유", () => {
    const candles: Candle[] = Array.from({length: 10}, (_, i) => ({
      t: i * DAY,
      o: 100 + i,
      h: 102 + i,
      l: 98 + i,
      c: 100 + i,
      v: 1,
    }));
    const inds = candles.map(() => row(2));
    const [up, dn] = buildSupertrendOverlays(candles, inds);
    expect(up.id).toBe("supertrend-up");
    expect(dn.id).toBe("supertrend-dn");
    expect(up.points.length).toBe(10);
    // 각 봉은 up 또는 dn 한쪽만 값 (양쪽 동시 값 X)
    for (let i = 0; i < 10; i++) {
      const hasUp = up.points[i].v !== undefined;
      const hasDn = dn.points[i].v !== undefined;
      expect(hasUp && hasDn).toBe(false);
    }
  });

  it("상승 추세 — up series 에 값", () => {
    // 꾸준한 상승 → up trend
    const candles: Candle[] = Array.from({length: 15}, (_, i) => ({
      t: i * DAY,
      o: 100 + i * 2,
      h: 103 + i * 2,
      l: 98 + i * 2,
      c: 101 + i * 2,
      v: 1,
    }));
    const inds = candles.map(() => row(1.5));
    const [up] = buildSupertrendOverlays(candles, inds);
    // 후반부 up 값 존재
    const lastFew = up.points.slice(-5).filter((p) => p.v !== undefined);
    expect(lastFew.length).toBeGreaterThan(0);
  });

  it("ATR 없으면 양쪽 모두 undefined (라인 끊김)", () => {
    const candles: Candle[] = [
      {t: 0, o: 100, h: 102, l: 98, c: 100, v: 1},
    ];
    const inds = [{t: 0, computed_version: 2} as IndicatorRow]; // atr 없음
    const [up, dn] = buildSupertrendOverlays(candles, inds);
    expect(up.points[0].v).toBeUndefined();
    expect(dn.points[0].v).toBeUndefined();
  });

  it("빈 입력 → []", () => {
    expect(buildSupertrendOverlays([], [])).toEqual([]);
  });
});
