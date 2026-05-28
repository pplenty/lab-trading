import {describe, expect, it} from "vitest";
import {
  avgHoldDays,
  cagrPct,
  mddPct,
  returnsFromEquity,
  sharpe,
  sortino,
  totalReturnPct,
  tradeCount,
  tradeQuality,
  winRatePct,
} from "./metrics";
import type {Trade} from "./types";

const DAY = 86400;

describe("totalReturnPct", () => {
  it("100 → 150 = +50%", () => {
    expect(totalReturnPct([100, 150])).toBeCloseTo(50, 10);
  });
  it("100 → 80 = -20%", () => {
    expect(totalReturnPct([100, 80])).toBeCloseTo(-20, 10);
  });
  it("empty / single point → 0", () => {
    expect(totalReturnPct([])).toBe(0);
    expect(totalReturnPct([100])).toBe(0);
  });
});

describe("cagrPct", () => {
  it("doubles in 365 days → 100%", () => {
    expect(cagrPct([100, 200], 365)).toBeCloseTo(100, 6);
  });
  it("quadruples in 730 days (2y) → 100% (sqrt)", () => {
    expect(cagrPct([100, 400], 730)).toBeCloseTo(100, 6);
  });
  it("dayCount 0 or negative → 0", () => {
    expect(cagrPct([100, 200], 0)).toBe(0);
    expect(cagrPct([100, 200], -1)).toBe(0);
  });
});

describe("mddPct", () => {
  it("monotone up → 0", () => {
    expect(mddPct([100, 110, 120, 130])).toBe(0);
  });
  it("100 → 200 → 150 → 200 → MDD = 25%", () => {
    expect(mddPct([100, 200, 150, 200])).toBeCloseTo(25, 6);
  });
  it("100 → 50 → 100 → MDD = 50%", () => {
    expect(mddPct([100, 50, 100])).toBeCloseTo(50, 6);
  });
});

describe("returnsFromEquity", () => {
  it("[100,110,121] → [0.1, 0.1]", () => {
    const r = returnsFromEquity([100, 110, 121]);
    expect(r[0]).toBeCloseTo(0.1, 10);
    expect(r[1]).toBeCloseTo(0.1, 10);
  });
});

describe("sharpe", () => {
  it("constant returns → 0 (no variance)", () => {
    expect(sharpe([0.001, 0.001, 0.001])).toBe(0);
  });
  it("positive deterministic → positive Sharpe", () => {
    const r = [0.01, 0.005, 0.012, 0.008, 0.011];
    expect(sharpe(r)).toBeGreaterThan(0);
  });
});

describe("sortino", () => {
  it("only positive returns → 0 (no downside)", () => {
    expect(sortino([0.01, 0.02, 0.005])).toBe(0);
  });
  it("mixed returns positive", () => {
    const r = [0.02, -0.01, 0.015, -0.005, 0.018];
    expect(sortino(r)).toBeGreaterThan(0);
  });
});

const mkTrade = (
  side: "buy" | "sell",
  t: number,
  equity: number
): Trade => ({
  side,
  t,
  price: 100,
  size: 1,
  cash: 0,
  equity,
});

describe("winRatePct / tradeCount / avgHoldDays", () => {
  it("3 round-trips, 2 wins → 66.67%", () => {
    const trades: Trade[] = [
      mkTrade("buy", 0, 1000),
      mkTrade("sell", 1 * DAY, 1100),
      mkTrade("buy", 2 * DAY, 1100),
      mkTrade("sell", 4 * DAY, 1050),
      mkTrade("buy", 5 * DAY, 1050),
      mkTrade("sell", 10 * DAY, 1200),
    ];
    expect(winRatePct(trades)).toBeCloseTo(66.6666, 3);
    expect(tradeCount(trades)).toBe(3);
    // hold days: 1, 2, 5 → avg ≈ 2.6667
    expect(avgHoldDays(trades)).toBeCloseTo(2.6666, 3);
  });

  it("only buys (no sells) → 0 trades, 0 win rate", () => {
    expect(tradeCount([mkTrade("buy", 0, 1000)])).toBe(0);
    expect(winRatePct([mkTrade("buy", 0, 1000)])).toBe(0);
  });

  it("hanging sell without prior buy is ignored", () => {
    const trades: Trade[] = [
      mkTrade("sell", 0, 1000),
      mkTrade("buy", 1 * DAY, 1000),
      mkTrade("sell", 2 * DAY, 1100),
    ];
    expect(tradeCount(trades)).toBe(1);
    expect(winRatePct(trades)).toBe(100);
  });
});

describe("tradeQuality", () => {
  it("2 wins (+10%, +14.3%) + 1 loss (-4.5%) → profitFactor > 1", () => {
    // equity: 1000→1100 (+10%), 1100→1050 (-4.5%), 1050→1200 (+14.3%)
    const trades: Trade[] = [
      mkTrade("buy", 0, 1000),
      mkTrade("sell", 1 * DAY, 1100),
      mkTrade("buy", 2 * DAY, 1100),
      mkTrade("sell", 4 * DAY, 1050),
      mkTrade("buy", 5 * DAY, 1050),
      mkTrade("sell", 10 * DAY, 1200),
    ];
    const q = tradeQuality(trades);
    // grossWin ≈ 10 + 14.29 = 24.29, grossLoss ≈ 4.545 → PF ≈ 5.34
    expect(q.profitFactor).toBeGreaterThan(1);
    expect(q.avgWinPct).toBeGreaterThan(0);
    expect(q.avgLossPct).toBeLessThan(0);
    expect(q.payoffRatio).toBeGreaterThan(0);
    expect(q.maxConsecutiveLosses).toBe(1);
  });

  it("손실 0 → profitFactor 999 cap", () => {
    const trades: Trade[] = [
      mkTrade("buy", 0, 1000),
      mkTrade("sell", 1 * DAY, 1100),
    ];
    expect(tradeQuality(trades).profitFactor).toBe(999);
  });

  it("연속 손실 3회 → maxConsecutiveLosses 3", () => {
    const trades: Trade[] = [
      mkTrade("buy", 0, 1000),
      mkTrade("sell", 1 * DAY, 950), // -5%
      mkTrade("buy", 2 * DAY, 950),
      mkTrade("sell", 3 * DAY, 900), // loss
      mkTrade("buy", 4 * DAY, 900),
      mkTrade("sell", 5 * DAY, 880), // loss
      mkTrade("buy", 6 * DAY, 880),
      mkTrade("sell", 7 * DAY, 1000), // win — 연속 끊김
    ];
    expect(tradeQuality(trades).maxConsecutiveLosses).toBe(3);
  });

  it("거래 없음 → 모두 0", () => {
    const q = tradeQuality([]);
    expect(q.profitFactor).toBe(0);
    expect(q.maxConsecutiveLosses).toBe(0);
  });
});
