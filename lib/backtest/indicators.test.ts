import {describe, expect, it} from "vitest";
import {
  atr,
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  volumeSma,
} from "./indicators";

// 알려진 시퀀스로 결정론·정확성 검증. 외부 라이브러리 비교 fixture 가 아니라,
// 손으로 계산 가능한 단순 값 + invariant (self-consistency) 위주.
// 외부 라이브러리 (pandas-ta, TradingView) 비교 fixture 는 BTC 5년 적재 후 추가 (Phase 1.5).

describe("sma", () => {
  it("constant series produces same constant", () => {
    const result = sma([5, 5, 5, 5, 5], 3);
    expect(result).toEqual([undefined, undefined, 5, 5, 5]);
  });

  it("[1..10] period=3 → [_,_,2,3,4,5,6,7,8,9]", () => {
    const result = sma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
    expect(result).toEqual([undefined, undefined, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("period=1 returns input as-is", () => {
    const input = [3, 7, 2, 9];
    expect(sma(input, 1)).toEqual(input);
  });

  it("warmup window is undefined", () => {
    const result = sma([1, 2, 3], 5);
    expect(result).toEqual([undefined, undefined, undefined]);
  });

  it("throws on zero / negative period", () => {
    expect(() => sma([1, 2], 0)).toThrow();
    expect(() => sma([1, 2], -1)).toThrow();
  });
});

describe("ema", () => {
  it("constant series produces same constant after warmup", () => {
    const result = ema([5, 5, 5, 5, 5, 5], 3);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    // period=3 위치 EMA = SMA of first 3 = 5
    expect(result[2]).toBeCloseTo(5, 10);
    expect(result[5]).toBeCloseTo(5, 10);
  });

  it("[2,4,6,8,10] period=3 → 시드 4, 다음들 손계산과 일치", () => {
    // alpha = 2/(3+1) = 0.5
    // i=2: seed = (2+4+6)/3 = 4
    // i=3: 8*0.5 + 4*0.5 = 6
    // i=4: 10*0.5 + 6*0.5 = 8
    const result = ema([2, 4, 6, 8, 10], 3);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBeCloseTo(4, 10);
    expect(result[3]).toBeCloseTo(6, 10);
    expect(result[4]).toBeCloseTo(8, 10);
  });

  it("returns all undefined when input shorter than period", () => {
    expect(ema([1, 2], 5)).toEqual([undefined, undefined]);
  });
});

describe("rsi", () => {
  it("strictly increasing series → RSI 100 (no losses)", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const result = rsi(values, 14);
    // 14개의 상승 → avgLoss=0 → RSI=100
    expect(result[14]).toBe(100);
    expect(result[15]).toBe(100);
  });

  it("strictly decreasing series → RSI 0 (no gains)", () => {
    const values = [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    const result = rsi(values, 14);
    expect(result[14]).toBeCloseTo(0, 10);
    expect(result[15]).toBeCloseTo(0, 10);
  });

  it("warmup window (i <= period) is undefined", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const result = rsi(values, 14);
    for (let i = 0; i < 14; i++) expect(result[i]).toBeUndefined();
    expect(result[14]).toBeDefined();
  });
});

describe("macd", () => {
  it("flat series → MACD line 0 once both EMAs warm up", () => {
    const values = new Array(60).fill(100);
    const result = macd(values);
    expect(result[25].macd).toBeCloseTo(0, 10);
    expect(result[34].signal).toBeCloseTo(0, 10);
    expect(result[34].hist).toBeCloseTo(0, 10);
  });

  it("warmup row (i < slow-1) all undefined", () => {
    const values = new Array(60).fill(100).map((v, i) => v + i);
    const result = macd(values);
    expect(result[24].macd).toBeUndefined();
    expect(result[24].signal).toBeUndefined();
    expect(result[24].hist).toBeUndefined();
  });

  it("throws when fast >= slow", () => {
    expect(() => macd([1, 2, 3], 12, 12)).toThrow();
    expect(() => macd([1, 2, 3], 26, 12)).toThrow();
  });
});

describe("bollinger", () => {
  it("constant series → upper = middle = lower (std=0)", () => {
    const result = bollinger([5, 5, 5, 5, 5, 5], 3);
    expect(result[2].middle).toBeCloseTo(5, 10);
    expect(result[2].upper).toBeCloseTo(5, 10);
    expect(result[2].lower).toBeCloseTo(5, 10);
  });

  it("alternating series check", () => {
    // [10, 20, 10, 20, 10] period=3
    // i=2: mean=(10+20+10)/3=13.333, var=((10-13.33)^2 + (20-13.33)^2 + (10-13.33)^2)/3
    //       = (11.11 + 44.44 + 11.11)/3 = 22.22 → std≈4.714
    const result = bollinger([10, 20, 10, 20, 10], 3, 2);
    expect(result[2].middle).toBeCloseTo(13.333, 3);
    const std = result[2].upper! - result[2].middle!;
    expect(std).toBeCloseTo(4.714 * 2, 2);
  });

  it("warmup window undefined", () => {
    const result = bollinger([1, 2, 3], 5);
    expect(result[0].middle).toBeUndefined();
    expect(result[2].middle).toBeUndefined();
  });
});

describe("atr", () => {
  it("constant high/low → TR=0 → ATR=0", () => {
    const h = new Array(20).fill(100);
    const l = new Array(20).fill(100);
    const c = new Array(20).fill(100);
    const result = atr(h, l, c, 14);
    expect(result[14]).toBeCloseTo(0, 10);
    expect(result[19]).toBeCloseTo(0, 10);
  });

  it("monotone widening range — ATR positive and growing", () => {
    const h = new Array(20).fill(0).map((_, i) => 100 + i);
    const l = new Array(20).fill(0).map((_, i) => 99 - i);
    const c = new Array(20).fill(0).map((_, i) => 100 + i * 0.5);
    const result = atr(h, l, c, 14);
    expect(result[14]).toBeGreaterThan(0);
    expect(result[19]!).toBeGreaterThan(result[14]!);
  });

  it("throws on length mismatch", () => {
    expect(() => atr([1, 2], [1], [1, 2], 14)).toThrow();
  });
});

describe("volumeSma", () => {
  it("equivalent to sma", () => {
    expect(volumeSma([100, 200, 300], 2)).toEqual(sma([100, 200, 300], 2));
  });
});

describe("deterministic re-computation", () => {
  it("same input → same output for sma/ema/rsi/macd/bollinger/atr", () => {
    const c = [
      100, 102, 101, 103, 105, 104, 106, 108, 107, 109, 110, 112, 111, 113,
      115, 114, 116, 118, 117, 119, 120, 122, 121, 123, 125, 124, 126, 128,
      127, 129, 130,
    ];
    const h = c.map((v) => v + 1);
    const l = c.map((v) => v - 1);
    expect(sma(c, 5)).toEqual(sma(c, 5));
    expect(ema(c, 12)).toEqual(ema(c, 12));
    expect(rsi(c, 14)).toEqual(rsi(c, 14));
    expect(macd(c)).toEqual(macd(c));
    expect(bollinger(c, 20)).toEqual(bollinger(c, 20));
    expect(atr(h, l, c, 14)).toEqual(atr(h, l, c, 14));
  });
});
