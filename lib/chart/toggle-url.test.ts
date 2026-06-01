import {describe, expect, it} from "vitest";
import {buildToggleHref} from "./toggle-url";

describe("buildToggleHref", () => {
  it("query 없는 basePath — 단순 ?range= 부착", () => {
    expect(buildToggleHref("/crypto/btc", {range: "1y"})).toBe(
      "/crypto/btc?range=1y"
    );
  });

  it("tf 포함 (1d 아님) → &tf= 부착", () => {
    expect(buildToggleHref("/crypto/btc", {range: "1y", tf: "1w"})).toBe(
      "/crypto/btc?range=1y&tf=1w"
    );
  });

  it("tf=1d (기본값) → tf 생략", () => {
    expect(buildToggleHref("/crypto/btc", {range: "6m", tf: "1d"})).toBe(
      "/crypto/btc?range=6m"
    );
  });

  it("query 보유 basePath(symbols) → 단일 ? + & 로 병합 (append 버그 회귀 방지)", () => {
    expect(
      buildToggleHref("/compare?symbols=crypto:btc,us:aapl", {range: "5y"})
    ).toBe("/compare?symbols=crypto:btc,us:aapl&range=5y");
  });

  it("기존 range 는 교체 — 중복 누적 X", () => {
    // basePath 에 이미 range 가 있어도 새 값으로 교체 (이전 버그: 계속 append)
    expect(
      buildToggleHref("/compare?symbols=crypto:btc&range=1y", {range: "5y"})
    ).toBe("/compare?symbols=crypto:btc&range=5y");
  });

  it("기존 tf 도 교체", () => {
    expect(
      buildToggleHref("/crypto/btc?range=1y&tf=1mo", {range: "1y", tf: "1w"})
    ).toBe("/crypto/btc?range=1y&tf=1w");
  });

  it("같은 range 를 반복 호출해도 멱등 (range 하나만)", () => {
    const once = buildToggleHref("/compare?symbols=a,b", {range: "5y"});
    const twice = buildToggleHref(once, {range: "5y"});
    expect(twice).toBe("/compare?symbols=a,b&range=5y");
    expect((twice.match(/range=/g) ?? []).length).toBe(1);
  });

  it("range 미지정 + 보존 param 만 → path?preserved", () => {
    expect(buildToggleHref("/compare?symbols=a,b", {})).toBe(
      "/compare?symbols=a,b"
    );
  });

  it("range·param 모두 없음 → path 그대로", () => {
    expect(buildToggleHref("/crypto/btc", {})).toBe("/crypto/btc");
  });
});
