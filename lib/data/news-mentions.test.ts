import {describe, expect, it} from "vitest";
import {rankNewsMentions} from "./news-mentions";

const art = (title: string, summary: string | null = null) => ({title, summary});

const KW: Record<string, string[]> = {
  btc: ["비트코인", "Bitcoin", "BTC"],
  eth: ["이더리움", "ETH"],
  "005930": ["삼성전자", "Samsung"],
};
const kwFor = (s: string) => KW[s] ?? [];

describe("rankNewsMentions", () => {
  it("종목별 언급 기사 수 집계 + 내림차순", () => {
    const r = rankNewsMentions([
      {
        asset: "crypto",
        symbols: ["btc", "eth"],
        keywordsFor: kwFor,
        articles: [
          art("비트코인 급등", "BTC 신고가"),
          art("이더리움 업데이트"),
          art("비트코인·이더리움 동반 상승"),
        ],
      },
    ]);
    // btc: 기사1(비트코인+BTC) + 기사3 = 2 / eth: 기사2 + 기사3 = 2
    // 동률 → symbol asc → 005930 없음, btc < eth
    expect(r).toEqual([
      {asset: "crypto", symbol: "btc", count: 2},
      {asset: "crypto", symbol: "eth", count: 2},
    ]);
  });

  it("한 기사에 keyword 여러 개 맞아도 종목당 1회(기사 단위)", () => {
    const r = rankNewsMentions([
      {
        asset: "crypto",
        symbols: ["btc"],
        keywordsFor: kwFor,
        articles: [art("비트코인 Bitcoin BTC 삼중 언급")],
      },
    ]);
    expect(r[0].count).toBe(1);
  });

  it("자산군 횡단 병합 + limit", () => {
    const r = rankNewsMentions(
      [
        {
          asset: "crypto",
          symbols: ["btc"],
          keywordsFor: kwFor,
          articles: [art("비트코인 1"), art("비트코인 2"), art("비트코인 3")],
        },
        {
          asset: "kr",
          symbols: ["005930"],
          keywordsFor: kwFor,
          articles: [art("삼성전자 실적")],
        },
      ],
      1
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({asset: "crypto", symbol: "btc", count: 3});
  });

  it("언급 0 종목은 제외", () => {
    const r = rankNewsMentions([
      {
        asset: "crypto",
        symbols: ["btc", "eth"],
        keywordsFor: kwFor,
        articles: [art("비트코인만 언급")],
      },
    ]);
    expect(r.map((m) => m.symbol)).toEqual(["btc"]);
  });

  it("keyword 없는 종목 / 빈 기사 → 안전", () => {
    expect(
      rankNewsMentions([
        {asset: "us", symbols: ["xyz"], keywordsFor: () => [], articles: [art("a")]},
      ])
    ).toEqual([]);
  });
});
