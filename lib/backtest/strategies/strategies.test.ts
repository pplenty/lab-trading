import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {buyAndHold} from "./buy-and-hold";
import {smaCross} from "./sma-cross";
import {rsiReversion} from "./rsi-reversion";
import {donchianBreakout} from "./donchian-breakout";
import {macdCross} from "./macd-cross";
import {bollingerReversion} from "./bollinger-reversion";
import {trendRsi} from "./trend-rsi";
import {supertrend} from "./supertrend";
import type {IndicatorRow} from "@/lib/types";
import {normalizeSignal, type Signal, type SignalAction} from "../types";

const mkCandle = (i: number, c: number): Candle => ({
  t: i * 86400,
  o: c,
  h: c,
  l: c,
  c,
  v: 1,
});

/** Signal (action 만 또는 {action, reason}) → action string — 테스트 단순화. */
const act = (s: Signal): SignalAction => normalizeSignal(s).action;

describe("buyAndHold", () => {
  it("first bar with no position → buy, subsequent → hold", () => {
    const state = buyAndHold.init({});
    expect(act(buyAndHold.onBar(mkCandle(0, 100), undefined, state, 0))).toBe("buy");
    expect(act(buyAndHold.onBar(mkCandle(1, 105), undefined, state, 1))).toBe(
      "hold"
    );
    expect(act(buyAndHold.onBar(mkCandle(2, 110), undefined, state, 1))).toBe(
      "hold"
    );
  });

  it("requiredIndicators is empty", () => {
    expect(buyAndHold.requiredIndicators({})).toEqual([]);
  });
});

describe("smaCross", () => {
  it("validateParams rejects fast >= slow", () => {
    expect(smaCross.validateParams!({fast: 50, slow: 20})).toMatch(/less than/);
    expect(smaCross.validateParams!({fast: 20, slow: 20})).toMatch(/less than/);
    expect(smaCross.validateParams!({fast: 20, slow: 50})).toBeNull();
  });

  it("requiredIndicators picks precomputed columns when matched", () => {
    expect(smaCross.requiredIndicators({fast: 20, slow: 50})).toEqual([
      "sma_20",
      "sma_50",
    ]);
    // fast=10 은 사전계산에 없음
    expect(smaCross.requiredIndicators({fast: 10, slow: 50})).toEqual([
      "sma_50",
    ]);
  });

  it("hold while prev sign undecided (first comparison) — no false buy on uptrend start", () => {
    const state = smaCross.init({fast: 3, slow: 5});
    // 첫 비교 봉부터 fast > slow 인 단조 상승은 우리가 이미 추세 안에 있는지 알 수 없으므로 hold.
    const upTrend = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    let pos: 0 | 1 = 0;
    for (let i = 0; i < upTrend.length; i++) {
      const sig = act(smaCross.onBar(mkCandle(i, upTrend[i]), undefined, state, pos));
      expect(sig).toBe("hold");
      if (sig === "buy") pos = 1;
    }
  });

  it("golden cross after a death cross triggers buy", () => {
    const state = smaCross.init({fast: 3, slow: 5});
    // 하락 → 반등: 데드크로스 (prev=-1) 후 골든크로스 (sign=1) → buy.
    const series = [20, 19, 18, 17, 16, 18, 20, 22, 24, 26];
    let pos: 0 | 1 = 0;
    let buyAtIdx = -1;
    for (let i = 0; i < series.length; i++) {
      const sig = act(smaCross.onBar(mkCandle(i, series[i]), undefined, state, pos));
      if (sig === "buy") {
        buyAtIdx = i;
        pos = 1;
      }
    }
    expect(buyAtIdx).toBeGreaterThanOrEqual(5);
  });

  it("death cross after a golden cross triggers sell", () => {
    const state = smaCross.init({fast: 3, slow: 5});
    // 상승 → 하락: 첫 추세는 hold(prevSign 미정) → 하락 반전 시점에 sell 후보지만
    // position=0 이라 sell 의미 X. 골든크로스 → 데드크로스 시나리오를 만들려면 buy 후 dead cross.
    const series = [10, 9, 8, 7, 6, 8, 10, 12, 14, 16, 14, 12, 10, 8, 6, 4];
    let pos: 0 | 1 = 0;
    let buyIdx = -1;
    let sellIdx = -1;
    for (let i = 0; i < series.length; i++) {
      const sig = act(smaCross.onBar(mkCandle(i, series[i]), undefined, state, pos));
      if (sig === "buy") {
        buyIdx = i;
        pos = 1;
      } else if (sig === "sell") {
        sellIdx = i;
        pos = 0;
      }
    }
    expect(buyIdx).toBeGreaterThan(0);
    expect(sellIdx).toBeGreaterThan(buyIdx);
  });

  it("constant price → no signal (no crossover)", () => {
    const state = smaCross.init({fast: 3, slow: 5});
    const pos: 0 | 1 = 0;
    for (let i = 0; i < 20; i++) {
      const sig = act(smaCross.onBar(mkCandle(i, 100), undefined, state, pos));
      // 가격이 같으면 fast == slow == 100, sign 0 → 첫 비교는 hold, 이후도 hold
      expect(sig).toBe("hold");
    }
  });
});

describe("rsiReversion", () => {
  it("validateParams rejects oversold >= overbought", () => {
    expect(
      rsiReversion.validateParams!({period: 14, oversold: 70, overbought: 30})
    ).toMatch(/less than/);
    expect(
      rsiReversion.validateParams!({period: 14, oversold: 30, overbought: 70})
    ).toBeNull();
  });

  it("requiredIndicators picks rsi_14 when default param", () => {
    expect(
      rsiReversion.requiredIndicators({
        period: 14,
        oversold: 30,
        overbought: 70,
      })
    ).toEqual(["rsi_14"]);
    expect(
      rsiReversion.requiredIndicators({
        period: 9,
        oversold: 30,
        overbought: 70,
      })
    ).toEqual([]);
  });

  it("strictly decreasing price → rsi reaches 0 → triggers buy", () => {
    const state = rsiReversion.init({period: 14, oversold: 30, overbought: 70});
    let buy = false;
    let pos: 0 | 1 = 0;
    for (let i = 0; i < 30; i++) {
      const sig = act(rsiReversion.onBar(mkCandle(i, 1000 - i * 10),
        undefined,
        state,
        pos));
      if (sig === "buy") {
        buy = true;
        pos = 1;
      }
    }
    expect(buy).toBe(true);
  });

  it("indicators row overrides streaming when precomputed available", () => {
    const state = rsiReversion.init({period: 14, oversold: 30, overbought: 70});
    // streaming 으로는 첫 봉에서 RSI 미정 — but indicators 에 명시
    const sig = act(rsiReversion.onBar(mkCandle(0, 100),
      {t: 0, computed_version: 1, rsi_14: 20},
      state,
      0));
    expect(sig).toBe("buy");
  });
});

describe("donchianBreakout", () => {
  it("buys when close breaks above N-day high (position=0)", () => {
    const state = donchianBreakout.init({highWindow: 5, lowWindow: 5});
    // 5 봉 high 가 100, 6번째 종가 110 → buy
    for (let i = 0; i < 5; i++) {
      expect(act(donchianBreakout.onBar(mkCandle(i, 100), undefined, state, 0))).toBe(
        "hold"
      );
    }
    expect(act(donchianBreakout.onBar(mkCandle(5, 110), undefined, state, 0))).toBe(
      "buy"
    );
  });

  it("sells when close breaks below M-day low (position=1)", () => {
    const state = donchianBreakout.init({highWindow: 5, lowWindow: 5});
    // 5 봉 low 100, 6번째 종가 90 → 보유 중이면 sell
    for (let i = 0; i < 5; i++) {
      donchianBreakout.onBar(mkCandle(i, 100), undefined, state, 1);
    }
    expect(act(donchianBreakout.onBar(mkCandle(5, 90), undefined, state, 1))).toBe(
      "sell"
    );
  });

  it("rejects invalid params", () => {
    expect(donchianBreakout.validateParams?.({highWindow: 3, lowWindow: 10})).toMatch(
      /≥ 5/
    );
    expect(
      donchianBreakout.validateParams?.({highWindow: 20, lowWindow: 10})
    ).toBeNull();
  });
});

describe("macdCross", () => {
  it("validates params (fast < slow)", () => {
    expect(macdCross.validateParams?.({fast: 12, slow: 26, signal: 9})).toBeNull();
    expect(macdCross.validateParams?.({fast: 26, slow: 12, signal: 9})).toMatch(
      /less than slow/
    );
  });

  it("requiredIndicators returns macd/macd_signal only for default (12,26,9)", () => {
    expect(macdCross.requiredIndicators({fast: 12, slow: 26, signal: 9})).toEqual([
      "macd",
      "macd_signal",
    ]);
    expect(macdCross.requiredIndicators({fast: 10, slow: 30, signal: 9})).toEqual([]);
  });

  it("buys on MACD > signal crossover (using indicators)", () => {
    const state = macdCross.init({fast: 12, slow: 26, signal: 9});
    // prevSign = 0 (init), 첫 봉 hold
    expect(
      act(macdCross.onBar(
        mkCandle(0, 100),
        {t: 0, computed_version: 2, macd: -1, macd_signal: 1},
        state,
        0
      ))
    ).toBe("hold");
    // 두 번째 봉: macd > signal → buy (sign 1 vs prev -1)
    expect(
      act(macdCross.onBar(
        mkCandle(1, 105),
        {t: 86400, computed_version: 2, macd: 2, macd_signal: 1},
        state,
        0
      ))
    ).toBe("buy");
  });
});

describe("bollingerReversion", () => {
  it("requiredIndicators returns bb fields for default (20, 2)", () => {
    expect(
      bollingerReversion.requiredIndicators({period: 20, stdDev: 2})
    ).toEqual(["bb_upper", "bb_middle", "bb_lower"]);
    expect(
      bollingerReversion.requiredIndicators({period: 10, stdDev: 2})
    ).toEqual([]);
  });

  it("buys when close drops below lower band (using indicators)", () => {
    const state = bollingerReversion.init({period: 20, stdDev: 2});
    const sig = act(bollingerReversion.onBar(mkCandle(0, 90),
      {
        t: 0,
        computed_version: 2,
        bb_upper: 110,
        bb_middle: 100,
        bb_lower: 95,
      },
      state,
      0));
    expect(sig).toBe("buy");
  });

  it("sells when close exceeds upper band", () => {
    const state = bollingerReversion.init({period: 20, stdDev: 2});
    const sig = act(bollingerReversion.onBar(mkCandle(0, 115),
      {
        t: 0,
        computed_version: 2,
        bb_upper: 110,
        bb_middle: 100,
        bb_lower: 90,
      },
      state,
      1));
    expect(sig).toBe("sell");
  });

  it("validates params (period 5..100, stdDev 1..4)", () => {
    expect(bollingerReversion.validateParams?.({period: 20, stdDev: 2})).toBeNull();
    expect(
      bollingerReversion.validateParams?.({period: 3, stdDev: 2})
    ).toMatch(/out of range/);
    expect(
      bollingerReversion.validateParams?.({period: 20, stdDev: 5})
    ).toMatch(/out of range/);
  });
});

function mkRow(p: Partial<IndicatorRow>): IndicatorRow {
  return {t: 0, computed_version: 2, ...p} as IndicatorRow;
}

describe("trendRsi (추세 필터 RSI)", () => {
  it("강세장 (close > SMA200) + RSI 과매도 → buy", () => {
    const state = trendRsi.init({oversold: 35, overbought: 65});
    const sig = trendRsi.onBar(
      mkCandle(0, 110), // close 110 > sma200 100
      mkRow({rsi_14: 30, sma_200: 100}),
      state,
      0
    );
    expect(act(sig)).toBe("buy");
  });

  it("하락장 (close < SMA200) RSI 과매도 → hold (필터 — 칼날 잡기 차단)", () => {
    const state = trendRsi.init({oversold: 35, overbought: 65});
    const sig = trendRsi.onBar(
      mkCandle(0, 90), // close 90 < sma200 100
      mkRow({rsi_14: 25, sma_200: 100}),
      state,
      0
    );
    expect(act(sig)).toBe("hold");
  });

  it("보유 중 RSI 과매수 → sell (차익)", () => {
    const state = trendRsi.init({oversold: 35, overbought: 65});
    const sig = trendRsi.onBar(
      mkCandle(0, 120),
      mkRow({rsi_14: 70, sma_200: 100}),
      state,
      1
    );
    expect(act(sig)).toBe("sell");
  });

  it("보유 중 추세 이탈 (close < SMA200) → sell (손절)", () => {
    const state = trendRsi.init({oversold: 35, overbought: 65});
    const sig = trendRsi.onBar(
      mkCandle(0, 95), // close 95 < sma200 100
      mkRow({rsi_14: 50, sma_200: 100}),
      state,
      1
    );
    expect(act(sig)).toBe("sell");
  });

  it("indicator 미충족 (sma_200 undefined) → hold", () => {
    const state = trendRsi.init({oversold: 35, overbought: 65});
    expect(
      act(trendRsi.onBar(mkCandle(0, 110), mkRow({rsi_14: 30}), state, 0))
    ).toBe("hold");
  });

  it("requiredIndicators = rsi_14 + sma_200", () => {
    expect(trendRsi.requiredIndicators({})).toEqual(["rsi_14", "sma_200"]);
  });

  it("validateParams rejects oversold >= overbought", () => {
    expect(trendRsi.validateParams?.({oversold: 70, overbought: 65})).toMatch(
      /less than/
    );
  });
});

describe("supertrend (ATR 추세추종)", () => {
  // h/l 다른 candle 빌더 — ATR 의미 위해
  const hlc = (h: number, l: number, c: number): Candle => ({
    t: 0,
    o: c,
    h,
    l,
    c,
    v: 1,
  });

  it("ATR 미충족 → hold", () => {
    const state = supertrend.init({multiplier: 3});
    expect(act(supertrend.onBar(hlc(110, 90, 100), mkRow({}), state, 0))).toBe(
      "hold"
    );
  });

  it("추세 상승 전환 시 buy (하락 → 상승)", () => {
    const state = supertrend.init({multiplier: 2});
    // 1봉: 낮은 종가로 down trend seed
    supertrend.onBar(hlc(50, 40, 42), mkRow({atr_14: 5}), state, 0);
    // 2봉: 종가 급등 → finalUpper 상향 돌파 → up 전환
    let buy = false;
    for (let i = 0; i < 5; i++) {
      const sig = supertrend.onBar(
        hlc(120 + i, 110 + i, 118 + i),
        mkRow({atr_14: 5}),
        state,
        0
      );
      if (act(sig) === "buy") buy = true;
    }
    expect(buy).toBe(true);
  });

  it("requiredIndicators = atr_14", () => {
    expect(supertrend.requiredIndicators({})).toEqual(["atr_14"]);
  });

  it("validateParams rejects non-positive multiplier", () => {
    expect(supertrend.validateParams?.({multiplier: 0})).toMatch(/positive/);
    expect(supertrend.validateParams?.({multiplier: 3})).toBeNull();
  });
});
