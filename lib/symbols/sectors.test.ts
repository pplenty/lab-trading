import {describe, expect, it} from "vitest";
import {getSector, getSameSector, listSectors, getSymbolsBySector} from "./sectors";

describe("sectors", () => {
  it("getSector — us aapl → 기술, kr 005930 → 반도체, crypto btc → Layer 1", () => {
    expect(getSector("us", "aapl")).toBe("기술");
    expect(getSector("us", "AAPL")).toBe("기술"); // case insensitive
    expect(getSector("kr", "005930")).toBe("반도체");
    expect(getSector("crypto", "btc")).toBe("Layer 1");
  });

  it("getSector — 매핑 없는 종목 → null", () => {
    expect(getSector("us", "unknown")).toBeNull();
    expect(getSector("kr", "999999")).toBeNull();
  });

  it("getSameSector — 같은 sector 의 다른 종목 list", () => {
    const sib = getSameSector("us", "aapl");
    // 기술 sector 의 다른 종목들 (msft, googl, meta, orcl, adbe, crm) 포함, aapl 자신 제외
    expect(sib).not.toContain("aapl");
    expect(sib).toContain("msft");
    expect(sib).toContain("googl");
    expect(sib.length).toBeGreaterThan(2);
  });

  it("getSameSector — kr 반도체 (005930) → 000660, 042700", () => {
    const sib = getSameSector("kr", "005930");
    expect(sib).toEqual(expect.arrayContaining(["000660", "042700"]));
    expect(sib).not.toContain("005930");
  });

  it("getSameSector — sector 없는 종목 → []", () => {
    expect(getSameSector("us", "unknown")).toEqual([]);
  });

  it("listSectors — 자산군별 sector 카운트 desc", () => {
    const us = listSectors("us");
    expect(us.length).toBeGreaterThan(0);
    // count desc 정렬
    for (let i = 1; i < us.length; i++) {
      expect(us[i].count).toBeLessThanOrEqual(us[i - 1].count);
    }
  });

  it("getSymbolsBySector — sector 의 모든 종목 반환", () => {
    const tech = getSymbolsBySector("us", "기술");
    expect(tech).toContain("aapl");
    expect(tech).toContain("msft");
  });
});
