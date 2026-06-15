import {describe, expect, it} from "vitest";
import {computeSectorPerformance} from "./sector-performance";

describe("computeSectorPerformance", () => {
  const quotes = [
    {symbol: "005930", changePct24h: 3},
    {symbol: "000660", changePct24h: 1},
    {symbol: "042700", changePct24h: -1},
  ];

  it("섹터 평균 + 격차 + 순위", () => {
    const r = computeSectorPerformance({
      sector: "반도체",
      selfSymbol: "005930",
      quotes,
    })!;
    expect(r.sector).toBe("반도체");
    expect(r.count).toBe(3);
    expect(r.sectorAvgPct).toBeCloseTo((3 + 1 - 1) / 3, 9); // 1.0
    expect(r.selfPct).toBe(3);
    expect(r.deltaPp).toBeCloseTo(3 - 1, 9); // +2.0%p
    expect(r.rank).toBe(1); // 3% 가 최고
  });

  it("섹터 하회 종목 — 음수 deltaPp + 후순위", () => {
    const r = computeSectorPerformance({
      sector: "반도체",
      selfSymbol: "042700",
      quotes,
    })!;
    expect(r.deltaPp).toBeCloseTo(-1 - 1, 9); // -2.0%p
    expect(r.rank).toBe(3);
  });

  it("자기 포함 1종목 → null (비교 불가)", () => {
    expect(
      computeSectorPerformance({
        sector: "오라클",
        selfSymbol: "link",
        quotes: [{symbol: "link", changePct24h: 5}],
      })
    ).toBeNull();
  });

  it("self 가 quotes 에 없으면 null", () => {
    expect(
      computeSectorPerformance({
        sector: "반도체",
        selfSymbol: "999999",
        quotes,
      })
    ).toBeNull();
  });
});
