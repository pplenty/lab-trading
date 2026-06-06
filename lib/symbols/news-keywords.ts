import type {AssetClass} from "@/lib/types";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// 종목 → 뉴스 매칭용 keyword 집합 (ADR-0008).
//
// 매칭 전략: 제목 또는 요약에 keyword 중 하나라도 substring 으로 포함 → 관련 뉴스.
// false positive 회피:
//   - 너무 짧은 단어 (≤2 char) 제외 — "V", "X" 등은 ambiguous
//   - 너무 일반적 (예: "엘지" / "현대") 도 제외 — 그룹 전체 매칭 X
//   - 코인 symbol upper (BTC) + 한국어 이름 (비트코인) + 영문 이름 (Bitcoin) 조합

const MIN_KEYWORD_LENGTH = 3;

/** 한 종목당 keyword 후보 — name/nameKo/ticker/symbol + 별칭. 짧거나 ambiguous 한 것 필터. */
function buildKeywords(
  fields: (string | undefined)[],
  extras: string[] = []
): string[] {
  const all = [...fields, ...extras]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
  // 짧은 단어 (≤2 char) 제외 — false positive ↑↑
  return Array.from(new Set(all.filter((k) => k.length >= MIN_KEYWORD_LENGTH)));
}

// 일부 종목은 단일 ticker / nameKo 만으론 ambiguous — 명시 alias 보강.
// e.g. "현대차" 는 "현대" 단독으론 현대건설/현대모비스 등과 겹쳐 alias 만 사용.
const KR_ALIASES: Record<string, string[]> = {
  "005930": ["삼성전자", "Samsung Electronics"],
  "000660": ["SK하이닉스", "하이닉스", "SK Hynix"],
  "005380": ["현대차", "현대자동차", "Hyundai Motor"],
  "005490": ["POSCO", "포스코홀딩스", "POSCO홀딩스"],
  "035420": ["네이버", "NAVER"],
  "035720": ["카카오", "Kakao"],
  "051910": ["LG화학", "LG Chem"],
  "068270": ["셀트리온", "Celltrion"],
  "086520": ["에코프로", "Ecopro"],
  "207940": ["삼성바이오로직스", "삼성바이오"],
  "247540": ["에코프로비엠", "에코프로BM"],
  "373220": ["LG에너지솔루션", "LG에너지", "LGES"],
  // Phase 2 확장
  "105560": ["KB금융", "KB Financial"],
  "055550": ["신한지주", "신한금융", "Shinhan Financial"],
  "033780": ["KT&G"],
  "042700": ["한미반도체"],
  "011200": ["HMM", "현대상선"],
  "012450": ["한화에어로스페이스", "Hanwha Aerospace"],
  "034020": ["두산에너빌리티", "Doosan Enerbility"],
  "006400": ["삼성SDI", "Samsung SDI"],
  "323410": ["카카오뱅크", "KakaoBank"],
  "259960": ["크래프톤", "Krafton"],
  "196170": ["알테오젠", "Alteogen"],
  "028300": ["HLB"],
  // 확장 (2026-06)
  "000270": ["기아", "Kia"],
  "066570": ["LG전자", "LG Electronics"],
  "012330": ["현대모비스", "Hyundai Mobis"],
  "028260": ["삼성물산", "Samsung C&T"],
  "015760": ["한국전력", "한전", "KEPCO"],
  "024110": ["기업은행", "IBK"],
  "329180": ["HD현대중공업", "현대중공업"],
  "263750": ["펄어비스", "Pearl Abyss"],
  "377300": ["카카오페이", "Kakao Pay"],
  "032830": ["삼성생명", "Samsung Life"],
};

const US_ALIASES: Record<string, string[]> = {
  aapl: ["애플", "Apple", "AAPL"],
  msft: ["마이크로소프트", "Microsoft", "MSFT"],
  nvda: ["엔비디아", "NVIDIA", "NVDA"],
  googl: ["알파벳", "Alphabet", "구글", "Google", "GOOGL"],
  amzn: ["아마존", "Amazon", "AMZN"],
  meta: ["메타", "Meta Platforms", "페이스북", "META"],
  tsla: ["테슬라", "Tesla", "TSLA"],
  jpm: ["JP모건", "JPMorgan", "JPM"],
  v: ["비자", "Visa"], // "V" 단독은 너무 짧음 — alias 만
  lly: ["일라이 릴리", "Eli Lilly", "LLY"],
  xom: ["엑손모빌", "ExxonMobil", "Exxon", "XOM"],
  brkb: ["버크셔", "Berkshire Hathaway", "BRK.B"],
  // Phase 2 확장
  wmt: ["월마트", "Walmart", "WMT"],
  unh: ["유나이티드헬스", "UnitedHealth", "UNH"],
  orcl: ["오라클", "Oracle", "ORCL"],
  hd: ["홈디포", "Home Depot"], // "HD" 단독은 ambiguous — alias 만
  ma: ["마스터카드", "Mastercard"], // "MA" 단독 제외
  pg: ["프록터", "P&G", "Procter"],  // "PG" 단독 제외
  cost: ["코스트코", "Costco", "COST"],
  avgo: ["브로드컴", "Broadcom", "AVGO"],
  abbv: ["애브비", "AbbVie", "ABBV"],
  cvx: ["쉐브론", "셰브론", "Chevron", "CVX"],
  ko: ["코카콜라", "Coca-Cola"], // "KO" 단독 제외 (한국 약어)
  pfe: ["화이자", "Pfizer", "PFE"],
  bac: ["뱅크오브아메리카", "Bank of America", "BofA", "BAC"],
  nflx: ["넷플릭스", "Netflix", "NFLX"],
  adbe: ["어도비", "Adobe", "ADBE"],
  crm: ["세일즈포스", "Salesforce", "CRM"],
  mrk: ["머크", "Merck"], // "MRK" 짧음 + 자체 ambiguous
  pep: ["펩시코", "PepsiCo", "Pepsi", "PEP"],
  // 확장 (2026-06)
  amd: ["AMD", "에이엠디"],
  intc: ["인텔", "Intel", "INTC"],
  qcom: ["퀄컴", "Qualcomm", "QCOM"],
  mu: ["마이크론", "Micron"], // "MU" 단독 제외
  pltr: ["팔란티어", "Palantir", "PLTR"],
  uber: ["우버", "Uber", "UBER"],
  dis: ["디즈니", "Disney"], // "DIS" 단독 제외
  coin: ["코인베이스", "Coinbase"], // "COIN" 단독 제외 (모든 코인 뉴스 매칭)
  spy: ["S&P 500", "S&P500", "SPY"],
  qqq: ["나스닥 100", "나스닥100", "QQQ"],
};

const CRYPTO_ALIASES: Record<string, string[]> = {
  btc: ["비트코인", "Bitcoin", "BTC"],
  eth: ["이더리움", "Ethereum", "ETH"],
  sol: ["솔라나", "Solana", "SOL"],
  xrp: ["리플", "XRP", "Ripple"],
  doge: ["도지코인", "Dogecoin", "DOGE"],
  ada: ["에이다", "Cardano", "ADA"],
  trx: ["트론", "TRON", "TRX"],
  avax: ["아발란체", "Avalanche", "AVAX"],
  link: ["체인링크", "Chainlink", "LINK"],
  matic: ["폴리곤", "Polygon", "MATIC", "POL"],
  dot: ["폴카닷", "Polkadot", "DOT"],
  // Phase 2 확장
  bch: ["비트코인캐시", "Bitcoin Cash", "BCH"],
  etc: ["이더리움클래식", "Ethereum Classic", "ETC"],
  atom: ["코스모스", "Cosmos", "ATOM"],
  near: ["니어프로토콜", "NEAR Protocol", "NEAR"],
  apt: ["앱토스", "Aptos", "APT"],
  arb: ["아비트럼", "Arbitrum", "ARB"],
  op: ["옵티미즘", "Optimism"], // "OP" 단독은 짧음/ambiguous
  sand: ["샌드박스", "The Sandbox", "SAND"],
  fil: ["파일코인", "Filecoin", "FIL"],
  algo: ["알고랜드", "Algorand", "ALGO"],
  aave: ["에이브", "Aave", "AAVE"],
  uni: ["유니스왑", "Uniswap"], // "UNI" 짧음 + 일반어
  vet: ["비체인", "VeChain", "VET"],
  hbar: ["헤데라", "Hedera", "HBAR"],
  mana: ["디센트럴랜드", "Decentraland", "MANA"],
  xlm: ["스텔라루멘", "스텔라", "Stellar", "XLM"],
  // 확장 (2026-06)
  sui: ["수이", "Sui", "SUI"],
  sei: ["세이", "Sei", "SEI"],
  tia: ["셀레스티아", "Celestia", "TIA"],
  inj: ["인젝티브", "Injective", "INJ"],
  wld: ["월드코인", "Worldcoin", "WLD"],
  pepe: ["페페", "Pepe", "PEPE"],
  shib: ["시바이누", "시바", "Shiba", "SHIB"],
  ondo: ["온도파이낸스", "Ondo", "ONDO"],
  ena: ["에테나", "Ethena", "ENA"],
  jup: ["주피터", "Jupiter", "JUP"],
};

/** 자산군 + symbol → keyword[]. 매칭 가능한 keyword 가 없으면 빈 배열. */
export function keywordsForSymbol(
  asset: AssetClass,
  symbol: string
): string[] {
  if (asset === "crypto") {
    const entry = cryptoRegistry.find((e) => e.symbol === symbol);
    if (!entry) return [];
    return buildKeywords(
      [entry.name, entry.nameKo],
      CRYPTO_ALIASES[symbol] ?? []
    );
  }
  if (asset === "us") {
    const entry = usRegistry.find((e) => e.symbol === symbol);
    if (!entry) return [];
    return buildKeywords(
      [entry.name, entry.nameKo, entry.ticker],
      US_ALIASES[symbol] ?? []
    );
  }
  // kr
  const entry = krRegistry.find((e) => e.symbol === symbol);
  if (!entry) return [];
  return buildKeywords(
    [entry.name, entry.nameKo, entry.ticker],
    KR_ALIASES[symbol] ?? []
  );
}
