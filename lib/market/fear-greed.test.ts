import {describe, expect, it} from "vitest";
import {
  needleAngleDeg,
  zoneFromClassification,
  zoneFromValue,
} from "./gauge";
import {parseFredVixCsv, vixToGreedScore} from "./fear-greed";

describe("zoneFromValue — alternative.me 경계", () => {
  it("극단적 공포 0-24", () => {
    expect(zoneFromValue(0)).toBe(0);
    expect(zoneFromValue(24)).toBe(0);
  });
  it("공포 25-44", () => {
    expect(zoneFromValue(25)).toBe(1);
    expect(zoneFromValue(44)).toBe(1);
  });
  it("중립 45-55", () => {
    expect(zoneFromValue(45)).toBe(2);
    expect(zoneFromValue(50)).toBe(2);
    expect(zoneFromValue(55)).toBe(2);
  });
  it("탐욕 56-75", () => {
    expect(zoneFromValue(56)).toBe(3);
    expect(zoneFromValue(75)).toBe(3);
  });
  it("극단적 탐욕 76-100", () => {
    expect(zoneFromValue(76)).toBe(4);
    expect(zoneFromValue(100)).toBe(4);
  });
  it("범위 밖 클램프", () => {
    expect(zoneFromValue(-10)).toBe(0);
    expect(zoneFromValue(999)).toBe(4);
  });
});

describe("zoneFromClassification — API 분류 문자열 우선", () => {
  it("alternative.me 5 라벨 매핑", () => {
    expect(zoneFromClassification("Extreme Fear", 10)).toBe(0);
    expect(zoneFromClassification("Fear", 35)).toBe(1);
    expect(zoneFromClassification("Neutral", 50)).toBe(2);
    expect(zoneFromClassification("Greed", 65)).toBe(3);
    expect(zoneFromClassification("Extreme Greed", 90)).toBe(4);
  });
  it("대소문자 무관", () => {
    expect(zoneFromClassification("EXTREME GREED", 90)).toBe(4);
  });
  it("미스매치 시 value 폴백", () => {
    expect(zoneFromClassification("", 10)).toBe(0);
    expect(zoneFromClassification("unknown", 80)).toBe(4);
  });
});

describe("needleAngleDeg — 0=좌(공포) 100=우(탐욕) 50=상", () => {
  it("경계 각도", () => {
    expect(needleAngleDeg(0)).toBe(180);
    expect(needleAngleDeg(100)).toBe(0);
    expect(needleAngleDeg(50)).toBe(90);
  });
  it("클램프", () => {
    expect(needleAngleDeg(-5)).toBe(180);
    expect(needleAngleDeg(150)).toBe(0);
  });
});

describe("vixToGreedScore — 낮은 VIX = 탐욕", () => {
  it("경계 (lo=10 탐욕 100 / hi=30 공포 0 / VIX 20 중립 50)", () => {
    expect(vixToGreedScore(10)).toBe(100); // 극단적 탐욕(평온)
    expect(vixToGreedScore(30)).toBe(0); // 극단적 공포
    expect(vixToGreedScore(20)).toBe(50); // 중립 — 역사적 평균
  });
  it("범위 밖 클램프", () => {
    expect(vixToGreedScore(5)).toBe(100);
    expect(vixToGreedScore(40)).toBe(0);
    expect(vixToGreedScore(80)).toBe(0);
  });
  it("단조 감소 (VIX↑ → 점수↓)", () => {
    expect(vixToGreedScore(15)).toBeGreaterThan(vixToGreedScore(30));
  });
});

describe("parseFredVixCsv — 결측/헤더 처리", () => {
  it("헤더 skip + '.' 결측 제외 + 순서 유지", () => {
    const csv = [
      "observation_date,VIXCLS",
      "2026-05-22,18.50",
      "2026-05-23,.",
      "2026-05-26,15.74",
    ].join("\n");
    const rows = parseFredVixCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({date: "2026-05-22", vix: 18.5});
    expect(rows[rows.length - 1]).toEqual({date: "2026-05-26", vix: 15.74});
  });
  it("빈/잘못된 입력 → 빈 배열", () => {
    expect(parseFredVixCsv("observation_date,VIXCLS")).toEqual([]);
    expect(parseFredVixCsv("")).toEqual([]);
  });
});
