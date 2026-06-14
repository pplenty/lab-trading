import {describe, expect, it} from "vitest";
import {buildRankingSummary, type RankingSummaryInput} from "./ranking-summary";

const names: Record<string, string> = {
  btc: "비트코인",
  eth: "이더리움",
  "005930": "삼성전자",
  aapl: "애플",
};
const dn = (s: string) => names[s] ?? s.toUpperCase();

const base: Omit<RankingSummaryInput, "kind" | "quotes"> = {
  cls: "crypto",
  displayName: dn,
  assetLabel: "코인",
  dateStr: "2026년 6월 14일",
};

describe("buildRankingSummary", () => {
  it("gainers — 1위 종목 + 상위 평균 상승률", () => {
    const s = buildRankingSummary({
      ...base,
      kind: "gainers",
      quotes: [
        {symbol: "btc", changePct24h: 8},
        {symbol: "eth", changePct24h: 6},
        {symbol: "aapl", changePct24h: 4},
      ],
    })!;
    expect(s).toContain("2026년 6월 14일 기준 코인 상승률 상위 종목입니다");
    expect(s).toContain("비트코인이 +8.00%로 가장 많이 올랐고");
    // 상위 3종목 평균 (8+6+4)/3 = 6
    expect(s).toContain("상위 3종목은 평균 +6.00% 상승");
  });

  it("losers — 1위 낙폭 + 상위 평균 하락", () => {
    const s = buildRankingSummary({
      ...base,
      kind: "losers",
      quotes: [
        {symbol: "eth", changePct24h: -10},
        {symbol: "btc", changePct24h: -4},
      ],
    })!;
    expect(s).toContain("하락률 상위 종목입니다");
    expect(s).toContain("이더리움이 -10.00%로 가장 많이 내렸고");
    expect(s).toContain("상위 2종목은 평균 -7.00% 하락");
  });

  it("volume — 거래 1위 종목", () => {
    const s = buildRankingSummary({
      ...base,
      kind: "volume",
      assetLabel: "국내주식",
      quotes: [
        {symbol: "005930", changePct24h: 1},
        {symbol: "aapl", changePct24h: -1},
      ],
    })!;
    expect(s).toContain("국내주식 거래량 상위 종목입니다");
    expect(s).toContain("삼성전자가 가장 활발하게 거래됐으며");
    expect(s).toContain("상위 2종목");
  });

  it("한글 조사 — 받침 있으면 이, 없으면 가", () => {
    const withB = buildRankingSummary({
      ...base,
      kind: "gainers",
      quotes: [{symbol: "btc", changePct24h: 3}],
    })!;
    expect(withB).toContain("비트코인이 "); // 인 → 받침 ㄴ → 이
    const noB = buildRankingSummary({
      ...base,
      kind: "gainers",
      quotes: [{symbol: "005930", changePct24h: 3}],
    })!;
    expect(noB).toContain("삼성전자가 "); // 자 → 받침 없음 → 가
  });

  it("topN 으로 상위 평균 대상 제한", () => {
    const s = buildRankingSummary({
      ...base,
      kind: "gainers",
      topN: 2,
      quotes: [
        {symbol: "btc", changePct24h: 10},
        {symbol: "eth", changePct24h: 6},
        {symbol: "aapl", changePct24h: 2},
      ],
    })!;
    // 상위 2종목 평균 (10+6)/2 = 8 (aapl 제외)
    expect(s).toContain("상위 2종목은 평균 +8.00%");
  });

  it("빈 quotes → null", () => {
    expect(
      buildRankingSummary({...base, kind: "gainers", quotes: []})
    ).toBeNull();
  });
});
