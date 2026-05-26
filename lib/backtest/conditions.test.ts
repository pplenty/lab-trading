import {describe, expect, it} from "vitest";
import type {Candle, IndicatorRow} from "@/lib/types";
import {
  evaluateCondition,
  evaluateGroup,
  formatCondition,
  formatGroup,
  type Condition,
  type ConditionGroup,
} from "./conditions";

const T = 1700000000;
function mkCandle(close: number, t = T): Candle {
  return {t, o: close, h: close, l: close, c: close, v: 1};
}
function mkRow(partial: Partial<IndicatorRow>): IndicatorRow {
  return {t: T, computed_version: 1, ...partial} as IndicatorRow;
}

describe("evaluateCondition", () => {
  it("rsi_14 < 30 — match", () => {
    const c: Condition = {
      left: {kind: "indicator", field: "rsi_14"},
      cmp: "lt",
      right: {kind: "constant", value: 30},
    };
    const row = mkRow({rsi_14: 28});
    expect(evaluateCondition(c, mkCandle(100), row, undefined, undefined)).toBe(true);
  });

  it("rsi_14 < 30 — fail when 32", () => {
    const c: Condition = {
      left: {kind: "indicator", field: "rsi_14"},
      cmp: "lt",
      right: {kind: "constant", value: 30},
    };
    const row = mkRow({rsi_14: 32});
    expect(evaluateCondition(c, mkCandle(100), row, undefined, undefined)).toBe(false);
  });

  it("close > sma_50", () => {
    const c: Condition = {
      left: {kind: "price", field: "close"},
      cmp: "gt",
      right: {kind: "indicator", field: "sma_50"},
    };
    const row = mkRow({sma_50: 100});
    expect(evaluateCondition(c, mkCandle(110), row, undefined, undefined)).toBe(true);
    expect(evaluateCondition(c, mkCandle(90), row, undefined, undefined)).toBe(false);
  });

  it("cross_above — sma_5 가 sma_20 위로 cross", () => {
    const c: Condition = {
      left: {kind: "indicator", field: "sma_5"},
      cmp: "cross_above",
      right: {kind: "indicator", field: "sma_20"},
    };
    // prev: sma_5 = 95, sma_20 = 100 (below) → curr: sma_5 = 105, sma_20 = 100 (above)
    const prev = mkRow({sma_5: 95, sma_20: 100});
    const curr = mkRow({sma_5: 105, sma_20: 100});
    expect(
      evaluateCondition(c, mkCandle(100), curr, mkCandle(100), prev)
    ).toBe(true);

    // 이미 위에 있으면 cross X
    const prevAlreadyAbove = mkRow({sma_5: 110, sma_20: 100});
    expect(
      evaluateCondition(c, mkCandle(100), curr, mkCandle(100), prevAlreadyAbove)
    ).toBe(false);
  });

  it("undefined indicator → false", () => {
    const c: Condition = {
      left: {kind: "indicator", field: "rsi_14"},
      cmp: "lt",
      right: {kind: "constant", value: 30},
    };
    const row = mkRow({}); // no rsi_14
    expect(evaluateCondition(c, mkCandle(100), row, undefined, undefined)).toBe(false);
  });
});

describe("evaluateGroup", () => {
  it("AND — 모두 true 만 true", () => {
    const g: ConditionGroup = {
      op: "AND",
      conditions: [
        {
          left: {kind: "indicator", field: "rsi_14"},
          cmp: "lt",
          right: {kind: "constant", value: 30},
        },
        {
          left: {kind: "price", field: "close"},
          cmp: "gt",
          right: {kind: "indicator", field: "sma_50"},
        },
      ],
    };
    const candle = mkCandle(110);
    const row = mkRow({rsi_14: 28, sma_50: 100});
    expect(evaluateGroup(g, candle, row, undefined, undefined)).toBe(true);

    // 한 조건만 fail
    const row2 = mkRow({rsi_14: 35, sma_50: 100}); // rsi fail
    expect(evaluateGroup(g, candle, row2, undefined, undefined)).toBe(false);
  });

  it("OR — 하나라도 true 면 true", () => {
    const g: ConditionGroup = {
      op: "OR",
      conditions: [
        {
          left: {kind: "indicator", field: "rsi_14"},
          cmp: "lt",
          right: {kind: "constant", value: 30},
        },
        {
          left: {kind: "indicator", field: "macd_hist"},
          cmp: "gt",
          right: {kind: "constant", value: 0},
        },
      ],
    };
    // rsi fail, macd OK
    const row = mkRow({rsi_14: 50, macd_hist: 0.5});
    expect(evaluateGroup(g, mkCandle(100), row, undefined, undefined)).toBe(true);

    // 둘 다 fail
    const row2 = mkRow({rsi_14: 50, macd_hist: -0.5});
    expect(evaluateGroup(g, mkCandle(100), row2, undefined, undefined)).toBe(false);
  });

  it("빈 그룹 → false", () => {
    const g: ConditionGroup = {op: "AND", conditions: []};
    expect(evaluateGroup(g, mkCandle(100), mkRow({}), undefined, undefined)).toBe(false);
  });
});

describe("URL serialization", () => {
  it("serialize → deserialize round-trip", async () => {
    const {serializeConfig, deserializeConfig} = await import("./conditions");
    const cfg = {
      buy: {
        op: "AND" as const,
        conditions: [
          {
            left: {kind: "indicator" as const, field: "rsi_14" as const},
            cmp: "lt" as const,
            right: {kind: "constant" as const, value: 30},
          },
        ],
      },
      sell: {
        op: "OR" as const,
        conditions: [
          {
            left: {kind: "indicator" as const, field: "rsi_14" as const},
            cmp: "gt" as const,
            right: {kind: "constant" as const, value: 70},
          },
        ],
      },
    };
    const s = serializeConfig(cfg);
    expect(typeof s).toBe("string");
    expect(s.length).toBeLessThan(500); // short enough for URL
    // base64 URL-safe — no +/=
    expect(s).not.toMatch(/[+/=]/);
    const back = deserializeConfig(s);
    expect(back).toEqual(cfg);
  });

  it("deserialize invalid → null", async () => {
    const {deserializeConfig} = await import("./conditions");
    expect(deserializeConfig("not-base64!@#")).toBeNull();
    expect(deserializeConfig("aGVsbG8")).toBeNull(); // valid base64 but not config
    expect(deserializeConfig("")).toBeNull();
  });
});

describe("format helpers", () => {
  it("formatCondition", () => {
    expect(
      formatCondition({
        left: {kind: "indicator", field: "rsi_14"},
        cmp: "lt",
        right: {kind: "constant", value: 30},
      })
    ).toBe("rsi_14 < 30");
  });

  it("formatGroup — AND/OR", () => {
    const g: ConditionGroup = {
      op: "AND",
      conditions: [
        {
          left: {kind: "indicator", field: "rsi_14"},
          cmp: "lt",
          right: {kind: "constant", value: 30},
        },
        {
          left: {kind: "price", field: "close"},
          cmp: "gt",
          right: {kind: "indicator", field: "sma_50"},
        },
      ],
    };
    expect(formatGroup(g)).toBe("rsi_14 < 30 AND close > sma_50");
  });
});
