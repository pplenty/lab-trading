// 자산군별 핵심 종목 매핑 테이블 (ADR-0010).
// 같은 자산이 어댑터마다 다른 ID 를 갖기 때문에 이 표가 단일 정답.
// 1차 출시는 코인 top ~30, 미장 top ~20 까지 직접 매핑. 그 외는 어댑터의 listAssets 동기화.
//
// 새 종목 추가 절차:
//   1) 사이트 심볼 결정 (lowercase ticker)
//   2) 어댑터별 식별자 채움
//   3) PR 1개 — 별도 ADR 없음

export type CryptoRegistryEntry = {
  /** lab-trading 사이트 심볼 (lowercase). */
  symbol: string;
  name: string;
  nameKo?: string;
  /** CoinGecko id (https://api.coingecko.com/api/v3/coins/list). */
  cgId: string;
  /** Binance 페어 — USDT 기본. 없으면 빈 문자열. */
  binancePair: string;
  /** Upbit market — KRW-BASE. 없으면 빈 문자열. */
  upbitMarket: string;
};

export const cryptoRegistry: CryptoRegistryEntry[] = [
  {symbol: "btc", name: "Bitcoin", nameKo: "비트코인", cgId: "bitcoin", binancePair: "BTCUSDT", upbitMarket: "KRW-BTC"},
  {symbol: "eth", name: "Ethereum", nameKo: "이더리움", cgId: "ethereum", binancePair: "ETHUSDT", upbitMarket: "KRW-ETH"},
  {symbol: "sol", name: "Solana", nameKo: "솔라나", cgId: "solana", binancePair: "SOLUSDT", upbitMarket: "KRW-SOL"},
  {symbol: "xrp", name: "XRP", nameKo: "리플", cgId: "ripple", binancePair: "XRPUSDT", upbitMarket: "KRW-XRP"},
  {symbol: "doge", name: "Dogecoin", nameKo: "도지코인", cgId: "dogecoin", binancePair: "DOGEUSDT", upbitMarket: "KRW-DOGE"},
  {symbol: "ada", name: "Cardano", nameKo: "에이다", cgId: "cardano", binancePair: "ADAUSDT", upbitMarket: "KRW-ADA"},
  {symbol: "trx", name: "TRON", nameKo: "트론", cgId: "tron", binancePair: "TRXUSDT", upbitMarket: "KRW-TRX"},
  {symbol: "avax", name: "Avalanche", nameKo: "아발란체", cgId: "avalanche-2", binancePair: "AVAXUSDT", upbitMarket: "KRW-AVAX"},
  {symbol: "link", name: "Chainlink", nameKo: "체인링크", cgId: "chainlink", binancePair: "LINKUSDT", upbitMarket: "KRW-LINK"},
  // Polygon — 2024 MATIC → POL 마이그레이션 후 Upbit 마켓은 KRW-POL. Binance / CoinGecko 는 아직 두 티커 노출하므로 binancePair / cgId 는 그대로 둠.
  {symbol: "matic", name: "Polygon", nameKo: "폴리곤", cgId: "matic-network", binancePair: "MATICUSDT", upbitMarket: "KRW-POL"},
  {symbol: "dot", name: "Polkadot", nameKo: "폴카닷", cgId: "polkadot", binancePair: "DOTUSDT", upbitMarket: "KRW-DOT"},
  // Litecoin — Upbit 는 2018 KRW 페어 종료 (BTC 페어만 운영). Upbit 어댑터에서 자동 제외.
  {symbol: "ltc", name: "Litecoin", nameKo: "라이트코인", cgId: "litecoin", binancePair: "LTCUSDT", upbitMarket: ""},
];

const bySymbol = new Map<string, CryptoRegistryEntry>(
  cryptoRegistry.map((e) => [e.symbol, e])
);
const byCgId = new Map<string, CryptoRegistryEntry>(
  cryptoRegistry.map((e) => [e.cgId, e])
);
const byBinancePair = new Map<string, CryptoRegistryEntry>(
  cryptoRegistry.filter((e) => e.binancePair).map((e) => [e.binancePair, e])
);
const byUpbitMarket = new Map<string, CryptoRegistryEntry>(
  cryptoRegistry.filter((e) => e.upbitMarket).map((e) => [e.upbitMarket, e])
);

export function getCryptoBySymbol(symbol: string): CryptoRegistryEntry | undefined {
  return bySymbol.get(symbol.toLowerCase());
}
export function getCryptoByCgId(cgId: string): CryptoRegistryEntry | undefined {
  return byCgId.get(cgId);
}
export function getCryptoByBinancePair(pair: string): CryptoRegistryEntry | undefined {
  return byBinancePair.get(pair.toUpperCase());
}
export function getCryptoByUpbitMarket(market: string): CryptoRegistryEntry | undefined {
  return byUpbitMarket.get(market.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────────
// 미장 (US) 종목 매핑 — ADR-0006 (Twelve Data 단독, 1차 출시).
// 더미 모드 (키 미발급) 시 GBM 시뮬레이션에 사용할 basePrice 동봉.
// basePrice 는 2026-05 시점 대략값 — deterministic 더미라 실제 시세와 일치할 필요는 없다.

export type UsRegistryEntry = {
  /** lab-trading 사이트 심볼 (lowercase, alnum). */
  symbol: string;
  /** Twelve Data 티커 (uppercase). 일반적으로 symbol uppercase. */
  ticker: string;
  name: string;
  nameKo?: string;
  market: "NASDAQ" | "NYSE" | "AMEX";
  /** 더미 GBM 시작가 (USD). 실제 API 모드에선 무시. */
  basePrice: number;
};

export const usRegistry: UsRegistryEntry[] = [
  {symbol: "aapl", ticker: "AAPL", name: "Apple Inc.", nameKo: "애플", market: "NASDAQ", basePrice: 220},
  {symbol: "msft", ticker: "MSFT", name: "Microsoft Corporation", nameKo: "마이크로소프트", market: "NASDAQ", basePrice: 425},
  {symbol: "nvda", ticker: "NVDA", name: "NVIDIA Corporation", nameKo: "엔비디아", market: "NASDAQ", basePrice: 135},
  {symbol: "googl", ticker: "GOOGL", name: "Alphabet Inc. Class A", nameKo: "알파벳 A", market: "NASDAQ", basePrice: 185},
  {symbol: "amzn", ticker: "AMZN", name: "Amazon.com, Inc.", nameKo: "아마존", market: "NASDAQ", basePrice: 215},
  {symbol: "meta", ticker: "META", name: "Meta Platforms, Inc.", nameKo: "메타", market: "NASDAQ", basePrice: 595},
  {symbol: "tsla", ticker: "TSLA", name: "Tesla, Inc.", nameKo: "테슬라", market: "NASDAQ", basePrice: 240},
  {symbol: "jpm", ticker: "JPM", name: "JPMorgan Chase & Co.", nameKo: "JP모건체이스", market: "NYSE", basePrice: 220},
  {symbol: "v", ticker: "V", name: "Visa Inc.", nameKo: "비자", market: "NYSE", basePrice: 280},
  {symbol: "lly", ticker: "LLY", name: "Eli Lilly and Company", nameKo: "일라이 릴리", market: "NYSE", basePrice: 740},
  {symbol: "xom", ticker: "XOM", name: "Exxon Mobil Corporation", nameKo: "엑손모빌", market: "NYSE", basePrice: 115},
  {symbol: "brkb", ticker: "BRK.B", name: "Berkshire Hathaway Inc. Class B", nameKo: "버크셔 해서웨이 B", market: "NYSE", basePrice: 455},
];

const usBySymbol = new Map<string, UsRegistryEntry>(
  usRegistry.map((e) => [e.symbol, e])
);
const usByTicker = new Map<string, UsRegistryEntry>(
  usRegistry.map((e) => [e.ticker, e])
);

export function getUsBySymbol(symbol: string): UsRegistryEntry | undefined {
  return usBySymbol.get(symbol.toLowerCase());
}
export function getUsByTicker(ticker: string): UsRegistryEntry | undefined {
  return usByTicker.get(ticker.toUpperCase());
}

// ──────────────────────────────────────────────────────────────────────────
// 국내주식 (KR) 종목 매핑 — ADR-0007 (KIS / KRX / data.go.kr / OpenDART, 4 공식 소스).
// 1차는 KIS 키 발급 전이라 어댑터 demo 모드 (GBM 시뮬레이션).
// 사이트 슬러그는 6자리 종목코드 그대로 (005930 = 삼성전자).

export type KrRegistryEntry = {
  /** 6자리 종목코드 (URL · D1 PK). */
  symbol: string;
  /** KIS / KRX / 공공데이터포털 공통 ticker (6자리 동일). */
  ticker: string;
  name: string;
  nameKo: string;
  market: "KOSPI" | "KOSDAQ";
  /** 더미 GBM 시작가 (KRW). 실제 API 모드에선 무시. */
  basePrice: number;
};

export const krRegistry: KrRegistryEntry[] = [
  {symbol: "005930", ticker: "005930", name: "Samsung Electronics", nameKo: "삼성전자", market: "KOSPI", basePrice: 70000},
  {symbol: "000660", ticker: "000660", name: "SK hynix", nameKo: "SK하이닉스", market: "KOSPI", basePrice: 200000},
  {symbol: "373220", ticker: "373220", name: "LG Energy Solution", nameKo: "LG에너지솔루션", market: "KOSPI", basePrice: 350000},
  {symbol: "207940", ticker: "207940", name: "Samsung Biologics", nameKo: "삼성바이오로직스", market: "KOSPI", basePrice: 900000},
  {symbol: "005380", ticker: "005380", name: "Hyundai Motor", nameKo: "현대차", market: "KOSPI", basePrice: 240000},
  {symbol: "005490", ticker: "005490", name: "POSCO Holdings", nameKo: "POSCO홀딩스", market: "KOSPI", basePrice: 300000},
  {symbol: "035420", ticker: "035420", name: "NAVER", nameKo: "NAVER", market: "KOSPI", basePrice: 180000},
  {symbol: "035720", ticker: "035720", name: "Kakao", nameKo: "카카오", market: "KOSPI", basePrice: 45000},
  {symbol: "051910", ticker: "051910", name: "LG Chem", nameKo: "LG화학", market: "KOSPI", basePrice: 300000},
  {symbol: "068270", ticker: "068270", name: "Celltrion", nameKo: "셀트리온", market: "KOSPI", basePrice: 190000},
  {symbol: "247540", ticker: "247540", name: "EcoPro BM", nameKo: "에코프로비엠", market: "KOSDAQ", basePrice: 140000},
  {symbol: "086520", ticker: "086520", name: "EcoPro", nameKo: "에코프로", market: "KOSDAQ", basePrice: 70000},
];

const krBySymbol = new Map<string, KrRegistryEntry>(
  krRegistry.map((e) => [e.symbol, e])
);

export function getKrBySymbol(symbol: string): KrRegistryEntry | undefined {
  return krBySymbol.get(symbol);
}

// ──────────────────────────────────────────────────────────────────────────
// 자산군 무관 통합 lookup — 즐겨찾기 / 최근 본 / 검색 등에서 사용.

import type {AssetClass} from "@/lib/types";

export type AssetMeta = {
  name: string;
  nameKo?: string;
  ticker: string;
};

export function getAssetMeta(
  cls: AssetClass,
  symbol: string
): AssetMeta | null {
  if (cls === "crypto") {
    const e = getCryptoBySymbol(symbol);
    return e
      ? {name: e.name, nameKo: e.nameKo, ticker: e.symbol.toUpperCase()}
      : null;
  }
  if (cls === "us") {
    const e = getUsBySymbol(symbol);
    return e ? {name: e.name, nameKo: e.nameKo, ticker: e.ticker} : null;
  }
  if (cls === "kr") {
    const e = getKrBySymbol(symbol);
    return e ? {name: e.name, nameKo: e.nameKo, ticker: e.ticker} : null;
  }
  return null;
}
