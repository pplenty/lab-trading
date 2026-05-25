import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {buildVwapOverlay} from "./overlays";

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
