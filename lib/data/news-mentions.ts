import type {AssetClass} from "@/lib/types";

// "뉴스 주목 종목" — 최근 로드된 뉴스 기사에서 종목별 언급 횟수 집계(aggregate).
// 기존 per-symbol 매칭(SymbolRelatedNews)을 역방향으로: 전 종목 × 전 기사 in-memory
// 매칭. /news 가 이미 로드한 기사 재사용 → 추가 D1 쿼리 0. keywordsForSymbol 재사용.

export type NewsMention = {
  asset: AssetClass;
  symbol: string;
  /** 이 종목 keyword 가 제목/요약에 등장한 기사 수. */
  count: number;
};

type Article = {title: string; summary: string | null};

/**
 * 자산군별 (기사 + 종목 + keyword resolver) 묶음에서 언급 횟수 상위 종목 랭킹.
 * 한 기사에 여러 keyword 가 맞아도 종목당 1회(기사 단위 카운트). count 0 은 제외.
 */
export function rankNewsMentions(
  inputs: Array<{
    asset: AssetClass;
    articles: Article[];
    symbols: string[];
    keywordsFor: (symbol: string) => string[];
  }>,
  limit = 10
): NewsMention[] {
  const out: NewsMention[] = [];
  for (const {asset, articles, symbols, keywordsFor} of inputs) {
    const texts = articles.map((a) => `${a.title} ${a.summary ?? ""}`);
    for (const symbol of symbols) {
      const kws = keywordsFor(symbol);
      if (kws.length === 0) continue;
      let count = 0;
      for (const t of texts) {
        if (kws.some((kw) => t.includes(kw))) count++;
      }
      if (count > 0) out.push({asset, symbol, count});
    }
  }
  out.sort((a, b) =>
    b.count !== a.count ? b.count - a.count : a.symbol.localeCompare(b.symbol)
  );
  return out.slice(0, limit);
}
