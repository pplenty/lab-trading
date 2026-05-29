import {describe, expect, it} from "vitest";
import type {Trade} from "./types";
import {pairRoundTrips} from "./round-trips";
import {tradesToCsv} from "./trades-csv";

const DAY = 86400;

function buy(t: number, price: number, equity: number, reason?: string): Trade {
  return {side: "buy", t: t * DAY, price, size: 1, cash: 0, equity, reason};
}
function sell(t: number, price: number, equity: number, reason?: string): Trade {
  return {side: "sell", t: t * DAY, price, size: 0, cash: equity, equity, reason};
}

describe("pairRoundTrips", () => {
  it("매수→매도 페어 → 1 round-trip (pnl/holdDays 계산)", () => {
    const trips = pairRoundTrips([buy(0, 100, 1000), sell(10, 120, 1200)]);
    expect(trips).toHaveLength(1);
    expect(trips[0].sell).not.toBeNull();
    expect(trips[0].pnl).toBe(200);
    expect(trips[0].pnlPct).toBeCloseTo(20, 5);
    expect(trips[0].holdDays).toBe(10);
  });

  it("미체결 마지막 buy → open round-trip (sell null, pnl null)", () => {
    const trips = pairRoundTrips([
      buy(0, 100, 1000),
      sell(5, 110, 1100),
      buy(8, 115, 1100),
    ]);
    expect(trips).toHaveLength(2);
    expect(trips[1].sell).toBeNull();
    expect(trips[1].pnl).toBeNull();
    expect(trips[1].holdDays).toBeNull();
  });

  it("빈 입력 → []", () => {
    expect(pairRoundTrips([])).toEqual([]);
  });
});

describe("tradesToCsv", () => {
  it("헤더 + round-trip 당 1줄", () => {
    const csv = tradesToCsv([buy(0, 100, 1000), sell(10, 120, 1200)]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "#,status,buy_date,buy_price,sell_date,sell_price,pnl,pnl_pct,hold_days,buy_reason,sell_reason"
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("1,closed,1970-01-01,100,1970-01-11,120,200,20,10,");
  });

  it("open position → status=open + 빈 sell 컬럼", () => {
    const csv = tradesToCsv([buy(0, 100, 1000)]);
    const row = csv.split("\n")[1];
    expect(row.startsWith("1,open,1970-01-01,100,,,,,,")).toBe(true);
  });

  it("쉼표·따옴표 포함 reason 은 CSV escape", () => {
    const csv = tradesToCsv([
      buy(0, 100, 1000, 'RSI<30, "oversold"'),
      sell(3, 110, 1100),
    ]);
    const row = csv.split("\n")[1];
    // 큰따옴표로 감싸고 내부 " → ""
    expect(row).toContain('"RSI<30, ""oversold"""');
  });

  it("빈 trades → 헤더만", () => {
    const csv = tradesToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});
