import {describe, expect, it} from "vitest";
import {searchPages, pageIndex} from "./pages";

describe("searchPages", () => {
  it("빈 query → []", () => {
    expect(searchPages("")).toEqual([]);
    expect(searchPages("   ")).toEqual([]);
  });

  it("한글 정확 매칭 — '백테스트'", () => {
    const r = searchPages("백테스트");
    expect(r.length).toBeGreaterThan(0);
    // 백테스트 / 커스텀 백테스트 / 포트폴리오 백테스트 모두 매칭, '백테스트' 가 최상위
    expect(r[0].href).toBe("/backtest/new");
  });

  it("영문 키워드 — 'portfolio'", () => {
    const r = searchPages("portfolio");
    const hrefs = r.map((p) => p.href);
    // 포트폴리오 백테스트 + 가상 포트폴리오 둘 다
    expect(hrefs).toContain("/backtest/portfolio");
    expect(hrefs).toContain("/portfolio");
  });

  it("키워드 별칭 — '리밸런스' → 포트폴리오 백테스트", () => {
    const r = searchPages("리밸런스");
    expect(r.some((p) => p.href === "/backtest/portfolio")).toBe(true);
  });

  it("키워드 별칭 — '백업' → 설정", () => {
    const r = searchPages("백업");
    expect(r.some((p) => p.href === "/settings")).toBe(true);
  });

  it("한글 초성 — 'ㅂㅌ' → 백테스트", () => {
    const r = searchPages("ㅂㅌ");
    // '백테스트' titleKo 초성 ㅂㅌㅅㅌ — prefix ㅂㅌ
    expect(r.some((p) => p.href === "/backtest/new")).toBe(true);
  });

  it("커스텀 — 'and' / '조건' → 커스텀 백테스트", () => {
    expect(searchPages("조건").some((p) => p.href === "/backtest/custom")).toBe(
      true
    );
  });

  it("매칭 없음 → []", () => {
    expect(searchPages("zzzznomatch")).toEqual([]);
  });

  it("limit 존중", () => {
    // 모든 페이지에 흔한 키워드는 없지만, limit 파라미터 동작 확인
    const r = searchPages("백테스트", 2);
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("pageIndex 모든 entry 가 href / titleKo / keywords 보유", () => {
    for (const p of pageIndex) {
      expect(p.href).toMatch(/^\//);
      expect(p.titleKo.length).toBeGreaterThan(0);
      expect(Array.isArray(p.keywords)).toBe(true);
    }
  });
});
