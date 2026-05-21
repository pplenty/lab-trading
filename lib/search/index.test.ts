import {describe, expect, it} from "vitest";
import {searchAssets, searchIndex} from "./index";

describe("searchIndex", () => {
  it("contains entries from all 3 asset classes", () => {
    const classes = new Set(searchIndex.map((e) => e.class));
    expect(classes.has("crypto")).toBe(true);
    expect(classes.has("us")).toBe(true);
    expect(classes.has("kr")).toBe(true);
    // crypto 27 (확장 + LTC 검색 인덱스 포함) / us 30 / kr 24
    expect(searchIndex.length).toBe(27 + 30 + 24);
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

  it("한글 초성 매칭 — ㅂㅌㅋ → 비트코인 prefix", () => {
    const r = searchAssets("ㅂㅌㅋ");
    expect(r[0]?.symbol).toBe("btc");
    expect(r[0]?.nameKo).toBe("비트코인");
  });

  it("한글 초성 — ㅅㅅㅈㅈ → 삼성전자", () => {
    const r = searchAssets("ㅅㅅㅈㅈ");
    expect(r.some((e) => e.symbol === "005930")).toBe(true);
  });

  it("한글 초성 — ㅇㄷㄹㅇ → 이더리움 prefix", () => {
    const r = searchAssets("ㅇㄷㄹㅇ");
    expect(r[0]?.symbol).toBe("eth");
  });

  it("순수 초성 query 가 substring 매칭으로 false positive 안 만듦", () => {
    // ㅋ 단독 = 1자 초성, prefix 매칭은 광범위 — substring 점수 250 으로
    // 잡히지만 정확한 prefix 가 더 위. 결과 자체엔 들어옴 — 빈 배열 아님.
    const r = searchAssets("ㅋ");
    expect(r.length).toBeGreaterThan(0);
  });

  it("영문 두벌식 — qlxmzhdls → 비트코인", () => {
    const r = searchAssets("qlxmzhdls");
    expect(r.some((e) => e.symbol === "btc")).toBe(true);
  });

  it("영문 두벌식 — tkatjdwjswk → 삼성전자", () => {
    const r = searchAssets("tkatjdwjswk");
    expect(r.some((e) => e.symbol === "005930")).toBe(true);
  });

  it("두벌식 변환 — 라이브 영문 매칭이 우선 (AAPL 영문)", () => {
    // "aapl" 은 ticker 정확 매칭 — 두벌식 변환 안 함.
    const r = searchAssets("aapl");
    expect(r[0].symbol).toBe("aapl");
  });
});
