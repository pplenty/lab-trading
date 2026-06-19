// 즐겨찾기 성과 다이제스트 — 관심종목(필터된 집합)의 24h 변동 요약.
// 외부 의존 0 순수 함수. quote 미로드(US tail 등)는 stale 로 분리해 가짜 0% 오인 방지.

export type DigestItem = {
  id: string; // "cls:symbol"
  symbol: string;
  /** quote.changePct24h. quote 미로드면 null. */
  changePct: number | null;
};

export type FavoriteDigest = {
  /** 집합 전체 종목 수. */
  count: number;
  /** quote 가 있는 종목 수. */
  quoted: number;
  /** quote 미로드(데이터 대기) 종목 수. */
  stale: number;
  upCount: number;
  downCount: number;
  flatCount: number;
  /** quote 있는 종목의 평균 24h 변동률. quoted 0 이면 null. */
  avgChangePct: number | null;
  topGainer: {id: string; symbol: string; changePct: number} | null;
  topLoser: {id: string; symbol: string; changePct: number} | null;
};

export function buildFavoriteDigest(items: DigestItem[]): FavoriteDigest {
  const count = items.length;
  const withQuote = items.filter(
    (i): i is DigestItem & {changePct: number} => i.changePct !== null
  );
  let up = 0;
  let down = 0;
  let flat = 0;
  let sum = 0;
  let topGainer: FavoriteDigest["topGainer"] = null;
  let topLoser: FavoriteDigest["topLoser"] = null;
  for (const i of withQuote) {
    if (i.changePct > 0) up++;
    else if (i.changePct < 0) down++;
    else flat++;
    sum += i.changePct;
    if (topGainer === null || i.changePct > topGainer.changePct) {
      topGainer = {id: i.id, symbol: i.symbol, changePct: i.changePct};
    }
    if (topLoser === null || i.changePct < topLoser.changePct) {
      topLoser = {id: i.id, symbol: i.symbol, changePct: i.changePct};
    }
  }
  const quoted = withQuote.length;
  return {
    count,
    quoted,
    stale: count - quoted,
    upCount: up,
    downCount: down,
    flatCount: flat,
    avgChangePct: quoted > 0 ? sum / quoted : null,
    topGainer,
    topLoser,
  };
}
