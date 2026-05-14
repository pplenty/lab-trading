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
  {symbol: "matic", name: "Polygon", nameKo: "폴리곤", cgId: "matic-network", binancePair: "MATICUSDT", upbitMarket: "KRW-MATIC"},
  {symbol: "dot", name: "Polkadot", nameKo: "폴카닷", cgId: "polkadot", binancePair: "DOTUSDT", upbitMarket: "KRW-DOT"},
  {symbol: "ltc", name: "Litecoin", nameKo: "라이트코인", cgId: "litecoin", binancePair: "LTCUSDT", upbitMarket: "KRW-LTC"},
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
