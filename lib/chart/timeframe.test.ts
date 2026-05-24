import {describe, expect, it} from "vitest";
import type {Candle} from "@/lib/types";
import {
  aggregateToMonthly,
  aggregateToWeekly,
  applyTimeframe,
  parseTimeframeParam,
} from "./timeframe";

const DAY = 86400;

function mkDaily(closes: number[], startT: number): Candle[] {
  return closes.map((c, i) => ({
    t: startT + i * DAY,
    o: c - 1,
    h: c + 2,
    l: c - 2,
    c,
    v: 100 + i,
  }));
}

// 2024-01-01 (Mon) UTC
const T_2024_01_01_MON = Math.floor(Date.UTC(2024, 0, 1) / 1000);
// 2024-01-07 (Sun) UTC
// 2024-02-01 (Thu) UTC
const T_2024_02_01 = Math.floor(Date.UTC(2024, 1, 1) / 1000);

describe("parseTimeframeParam", () => {
  it("returns default for empty/invalid", () => {
    expect(parseTimeframeParam(undefined)).toBe("1d");
    expect(parseTimeframeParam("xxx")).toBe("1d");
  });
  it("parses 1w / 1mo", () => {
    expect(parseTimeframeParam("1w")).toBe("1w");
    expect(parseTimeframeParam("1mo")).toBe("1mo");
    expect(parseTimeframeParam(["1w"])).toBe("1w");
  });
});

describe("aggregateToWeekly", () => {
  it("7일 = 1 봉 (Monday 시작)", () => {
    // 2024-01-01 (Mon) ~ 2024-01-07 (Sun) — 7 일봉
    const daily = mkDaily([100, 102, 105, 103, 108, 106, 110], T_2024_01_01_MON);
    const weekly = aggregateToWeekly(daily);
    expect(weekly.length).toBe(1);
    const w = weekly[0];
    // open = 첫 봉 o = 99 (100 - 1)
    expect(w.o).toBe(99);
    // close = 마지막 봉 c = 110
    expect(w.c).toBe(110);
    // high = max h = 112 (110 + 2)
    expect(w.h).toBe(112);
    // low = min l = 98 (100 - 2)
    expect(w.l).toBe(98);
    // volume = sum = 100+101+...+106 = 721
    expect(w.v).toBe(721);
  });
  it("14일 → 2 봉 (Mon~Sun, Mon~Sun)", () => {
    const daily = mkDaily(Array.from({length: 14}, (_, i) => 100 + i), T_2024_01_01_MON);
    const weekly = aggregateToWeekly(daily);
    expect(weekly.length).toBe(2);
    // 첫 주: close = 106 (7번째 일봉)
    expect(weekly[0].c).toBe(106);
    // 둘째 주: open = 첫 봉 o = 106 (107 - 1)
    expect(weekly[1].o).toBe(106);
    expect(weekly[1].c).toBe(113);
  });
  it("주 중간 시작 (Wed) — 부분 주 + 다음 주", () => {
    // 2024-01-03 (Wed) ~ 2024-01-09 (Tue) — 7 일봉, 2 주에 걸침
    const wedStart = T_2024_01_01_MON + 2 * DAY;
    const daily = mkDaily([100, 101, 102, 103, 104, 105, 106], wedStart);
    const weekly = aggregateToWeekly(daily);
    expect(weekly.length).toBe(2);
    // 첫 주 (Wed~Sun) = 5 봉
    expect(weekly[0].c).toBe(104);
    // 둘째 주 (Mon~Tue) = 2 봉
    expect(weekly[1].o).toBe(104); // 105 - 1
    expect(weekly[1].c).toBe(106);
  });
});

describe("aggregateToMonthly", () => {
  it("Jan 31일 + Feb 28일 → 2 월봉", () => {
    const jan = mkDaily(Array.from({length: 31}, (_, i) => 100 + i), T_2024_01_01_MON);
    const feb = mkDaily(Array.from({length: 28}, (_, i) => 130 + i), T_2024_02_01);
    const daily = [...jan, ...feb];
    const monthly = aggregateToMonthly(daily);
    expect(monthly.length).toBe(2);
    // Jan: open = 99 (100-1), close = 130 (last day)
    expect(monthly[0].o).toBe(99);
    expect(monthly[0].c).toBe(130);
    // Feb: open = 129 (130-1), close = 157 (130+27)
    expect(monthly[1].o).toBe(129);
    expect(monthly[1].c).toBe(157);
  });
});

describe("applyTimeframe", () => {
  it("1d returns input as-is", () => {
    const daily = mkDaily([100, 101, 102], T_2024_01_01_MON);
    const out = applyTimeframe(daily, "1d");
    expect(out).toBe(daily);
  });
  it("1w dispatches to weekly", () => {
    const daily = mkDaily([100, 101, 102, 103, 104, 105, 106], T_2024_01_01_MON);
    const out = applyTimeframe(daily, "1w");
    expect(out.length).toBe(1);
  });
  it("1mo dispatches to monthly", () => {
    const jan = mkDaily(Array.from({length: 10}, (_, i) => 100 + i), T_2024_01_01_MON);
    const out = applyTimeframe(jan, "1mo");
    expect(out.length).toBe(1);
  });
});
