import {describe, expect, it} from "vitest";
import {searchAssets, searchIndex} from "./index";

describe("searchIndex", () => {
  it("contains entries from all 3 asset classes", () => {
    const classes = new Set(searchIndex.map((e) => e.class));
    expect(classes.has("crypto")).toBe(true);
    expect(classes.has("us")).toBe(true);
    expect(classes.has("kr")).toBe(true);
    expect(searchIndex.length).toBe(12 + 12 + 12);
  });
});

describe("searchAssets", () => {
  it("exact symbol match ranks top", () => {
    const r = searchAssets("btc");
    expect(r[0].symbol).toBe("btc");
    expect(r[0].class).toBe("crypto");
  });

  it("ticker prefix matches (US uppercase)", () => {
    const r = searchAssets("AAP");
    expect(r[0].symbol).toBe("aapl");
  });

  it("Korean name substring matches", () => {
    const r = searchAssets("비트");
    expect(r[0].symbol).toBe("btc");
    expect(r[0].nameKo).toBe("비트코인");
  });

  it("Korean partial 삼성 returns 삼성전자 + 삼성바이오로직스 in some order", () => {
    const r = searchAssets("삼성");
    const symbols = r.map((e) => e.symbol);
    expect(symbols).toContain("005930");
    expect(symbols).toContain("207940");
  });

  it("6 자리 코드 검색 (005930 → 삼성전자)", () => {
    const r = searchAssets("005930");
    expect(r[0].symbol).toBe("005930");
    expect(r[0].class).toBe("kr");
  });

  it("English name word prefix (Apple → AAPL)", () => {
    const r = searchAssets("Apple");
    expect(r[0].symbol).toBe("aapl");
  });

  it("empty query returns empty", () => {
    expect(searchAssets("")).toEqual([]);
    expect(searchAssets("   ")).toEqual([]);
  });

  it("no matches returns empty", () => {
    expect(searchAssets("zzzzzz")).toEqual([]);
  });

  it("respects limit", () => {
    const r = searchAssets("a", 3);
    expect(r.length).toBeLessThanOrEqual(3);
  });
});
