import type {AssetClass} from "@/lib/types";

// 종목 sector 매핑 — registry 에 직접 추가 대신 별도 lookup table.
// 80 종목 manual 분류 (Phase 2 마감 시점).
//
// 의도:
// - 종목 상세 페이지 "같은 섹터" 우선 정렬
// - 향후 자산군 인덱스 페이지의 sector filter
// - 분산투자 검증 (사용자 보유 종목의 sector 분포)

export type Sector = string;

const CRYPTO_SECTOR: Record<string, Sector> = {
  // Layer 1 (smart contract platform)
  btc: "Layer 1",
  eth: "Layer 1",
  sol: "Layer 1",
  ada: "Layer 1",
  avax: "Layer 1",
  dot: "Layer 1",
  atom: "Layer 1",
  near: "Layer 1",
  apt: "Layer 1",
  algo: "Layer 1",
  hbar: "Layer 1",
  trx: "Layer 1",
  // L2 / scaling
  matic: "Layer 2",
  arb: "Layer 2",
  op: "Layer 2",
  // payments
  xrp: "결제",
  ltc: "결제",
  bch: "결제",
  etc: "결제",
  xlm: "결제",
  // DeFi
  aave: "DeFi",
  uni: "DeFi",
  // Oracle / Infra
  link: "오라클",
  fil: "스토리지",
  vet: "공급망",
  // Meme
  doge: "밈",
  // Metaverse / Gaming
  sand: "메타버스",
  mana: "메타버스",
  // 확장 (2026-06)
  sui: "Layer 1",
  sei: "Layer 1",
  tia: "Layer 1",
  wld: "Layer 1",
  inj: "DeFi",
  ondo: "DeFi",
  ena: "DeFi",
  jup: "DeFi",
  pepe: "밈",
  shib: "밈",
};

const US_SECTOR: Record<string, Sector> = {
  // 기술
  aapl: "기술",
  msft: "기술",
  nvda: "반도체",
  googl: "기술",
  meta: "기술",
  orcl: "기술",
  adbe: "기술",
  crm: "기술",
  avgo: "반도체",
  // 통신
  nflx: "통신",
  // 소비재
  amzn: "소비재",
  tsla: "소비재",
  wmt: "소비재",
  hd: "소비재",
  cost: "소비재",
  ko: "소비재",
  pep: "소비재",
  pg: "소비재",
  // 금융
  jpm: "금융",
  v: "금융",
  ma: "금융",
  bac: "금융",
  brkb: "금융",
  // 헬스
  lly: "헬스",
  unh: "헬스",
  abbv: "헬스",
  pfe: "헬스",
  mrk: "헬스",
  // 에너지
  xom: "에너지",
  cvx: "에너지",
  // 확장 (2026-06)
  amd: "반도체",
  intc: "반도체",
  qcom: "반도체",
  mu: "반도체",
  pltr: "기술",
  uber: "기술",
  dis: "통신",
  coin: "금융",
  spy: "ETF",
  qqq: "ETF",
};

const KR_SECTOR: Record<string, Sector> = {
  // 반도체
  "005930": "반도체",
  "000660": "반도체",
  "042700": "반도체",
  // 2차전지
  "373220": "2차전지",
  "006400": "2차전지",
  "247540": "2차전지",
  "086520": "2차전지",
  // 자동차
  "005380": "자동차",
  // 화학·소재
  "051910": "화학",
  "005490": "소재",
  // IT 서비스
  "035420": "IT 서비스",
  "035720": "IT 서비스",
  // 게임
  "259960": "게임",
  // 바이오
  "207940": "바이오",
  "068270": "바이오",
  "196170": "바이오",
  "028300": "바이오",
  // 금융
  "105560": "금융",
  "055550": "금융",
  "323410": "금융",
  // 소비재
  "033780": "소비재",
  // 운송
  "011200": "운송",
  // 방산
  "012450": "방산",
  // 에너지
  "034020": "에너지",
  "015760": "에너지",
  // 확장 (2026-06)
  "000270": "자동차",
  "012330": "자동차",
  "066570": "전자",
  "028260": "건설",
  "329180": "조선",
  "263750": "게임",
  "024110": "금융",
  "377300": "금융",
  "032830": "금융",
  "069500": "ETF",
};

export function getSector(cls: AssetClass, symbol: string): Sector | null {
  const key = symbol.toLowerCase();
  if (cls === "crypto") return CRYPTO_SECTOR[key] ?? null;
  if (cls === "us") return US_SECTOR[key] ?? null;
  if (cls === "kr") return KR_SECTOR[symbol] ?? null; // 6자리 그대로
  return null;
}

/** 같은 자산군 + 같은 sector 인 다른 종목 list. */
export function getSameSector(
  cls: AssetClass,
  symbol: string
): string[] {
  const sector = getSector(cls, symbol);
  if (!sector) return [];
  const map =
    cls === "crypto" ? CRYPTO_SECTOR : cls === "us" ? US_SECTOR : KR_SECTOR;
  const out: string[] = [];
  for (const [s, sec] of Object.entries(map)) {
    if (s !== (cls === "kr" ? symbol : symbol.toLowerCase()) && sec === sector) {
      out.push(s);
    }
  }
  return out;
}

/** sector → 같은 자산군의 모든 종목 (sector chip 클릭 시). */
export function getSymbolsBySector(
  cls: AssetClass,
  sector: Sector
): string[] {
  const map =
    cls === "crypto" ? CRYPTO_SECTOR : cls === "us" ? US_SECTOR : KR_SECTOR;
  return Object.entries(map)
    .filter(([, s]) => s === sector)
    .map(([sym]) => sym);
}

/** 자산군의 모든 sector + 종목 수. */
export function listSectors(cls: AssetClass): Array<{sector: Sector; count: number}> {
  const map =
    cls === "crypto" ? CRYPTO_SECTOR : cls === "us" ? US_SECTOR : KR_SECTOR;
  const counts = new Map<Sector, number>();
  for (const sec of Object.values(map)) {
    counts.set(sec, (counts.get(sec) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([sector, count]) => ({sector, count}))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.sector.localeCompare(b.sector, "ko");
    });
}
