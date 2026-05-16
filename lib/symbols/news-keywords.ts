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
