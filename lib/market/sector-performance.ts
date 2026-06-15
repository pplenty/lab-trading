// 종목 상세 "섹터 대비 성과" — 이 종목 24h 변동 vs 같은 섹터 peer 평균(상대강도).
// 같은 섹터 quotes(1회 배치 D1 read)에서 평균·순위·격차를 파생. 순수 함수.

export type SectorPerformance = {
  sector: string;
  /** 섹터 종목 수(자기 포함). */
  count: number;
  /** 섹터 평균 24h 변동률(%). */
  sectorAvgPct: number;
  /** 이 종목 24h 변동률(%). */
  selfPct: number;
  /** 이 종목 − 섹터 평균 (%포인트). 양수면 섹터 상회. */
  deltaPp: number;
  /** 섹터 내 순위 (24h 변동 내림차순, 1-based). */
  rank: number;
};

type SectorQuote = {symbol: string; changePct24h: number};

export function computeSectorPerformance(input: {
  sector: string;
  selfSymbol: string;
  quotes: SectorQuote[];
}): SectorPerformance | null {
  const {sector, selfSymbol, quotes} = input;
  // 비교 의미가 있으려면 자기 포함 2종목 이상.
  if (quotes.length < 2) return null;
  const self = quotes.find((q) => q.symbol === selfSymbol);
  if (!self) return null;

  const sum = quotes.reduce((s, q) => s + q.changePct24h, 0);
  const sectorAvgPct = sum / quotes.length;

  // 순위 — 변동률 내림차순. 동률은 먼저 만난 순서(안정).
  const sorted = [...quotes].sort((a, b) => b.changePct24h - a.changePct24h);
  const rank = sorted.findIndex((q) => q.symbol === selfSymbol) + 1;

  return {
    sector,
    count: quotes.length,
    sectorAvgPct,
    selfPct: self.changePct24h,
    deltaPp: self.changePct24h - sectorAvgPct,
    rank,
  };
}
