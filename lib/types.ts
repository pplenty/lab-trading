// 공통 데이터 타입 (ADR-0010).
// 자산군 · 어댑터 · 페이지 · 백테스트 모두 이 타입만 import.
// 어댑터별 raw 응답은 어댑터 내부에서 normalize 해 이 타입으로 변환.

export type AssetClass = "crypto" | "us" | "kr";

/**
 * 정규화된 lab-trading 사이트 심볼 — URL · KV 키 · D1 PK 모두 공통.
 * 형식:
 *   crypto: lowercase ticker  (`btc`, `eth`, `sol`, `doge`)
 *   us:     lowercase ticker  (`aapl`, `tsla`, `nvda`)
 *   kr:     6 자리 종목코드   (`005930`, `035720`)
 * 자산군 prefix 는 URL 경로 `/<class>/<symbol>` 로 분리되므로 Symbol 자체엔 포함 안 함.
 */
export type Symbol = string;

/** 정적 자산 메타. */
export interface Asset {
  class: AssetClass;
  symbol: Symbol;
  /** 원본 정식명 (원본 표기 그대로 — 컨벤션 G). */
  name: string;
  /** 한글 표기 (있을 때만). 자산군 통합 검색 한글 alias 에 사용 (ADR-0022). */
  nameKo?: string;
  /** 거래소 ticker (원본). 예: AAPL, 005930, BTC. */
  ticker?: string;
  logoUrl?: string;
  description?: string;
  /** 시장 — "NASDAQ", "KOSPI", "KRW" 등. */
  market?: string;
  /** ISO 4217 currency — USD / KRW / USDT 등. */
  currency: string;
  isin?: string;
  /** CoinGecko id (crypto only). */
  cgId?: string;
  /** CoinMarketCap id (crypto only). */
  cmcId?: number;
}

/** 시세 스냅샷. */
export interface Quote {
  symbol: Symbol;
  class: AssetClass;
  price: number;
  currency: string;
  /** -3.5 = -3.5%. UI 표시 시 부호 + 화살표 병기 (컨벤션 I). */
  changePct24h: number;
  changeAbs24h?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  marketCap?: number;
  /** 시가총액 순위 (crypto). */
  rank?: number;
  /** ISO 8601 (어댑터 응답 시각 또는 갱신 시각). */
  updatedAt: string;
  /** 어댑터 식별자 — "coingecko" / "upbit" / "binance" / "twelve-data" / "kis". */
  source: string;
}

/** 일봉 캔들. 백테스트·차트·D1 모두 공유. */
export interface Candle {
  /** unix epoch seconds, UTC. 일봉이면 거래일 00:00 UTC 또는 거래소 표준 시점. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** 일봉 시리즈 + 메타. */
export interface CandleSeries {
  symbol: Symbol;
  class: AssetClass;
  currency: string;
  timeframe: Timeframe;
  candles: Candle[];
  /** 어댑터 식별자. */
  source: string;
  /** 캐시된 시각 (어댑터 응답 시점). ISO 8601. */
  cachedAt: string;
}

export type Timeframe = "1d" | "1w" | "1mo";

/** ADR-0021 indicators 사전계산. wide format — candles 와 1:1, (symbol, t) 가 PK. */
export type IndicatorRow = {
  t: number;
  computed_version: number;
  sma_5?: number;
  sma_20?: number;
  sma_50?: number;
  sma_100?: number;
  sma_200?: number;
  ema_12?: number;
  ema_26?: number;
  ema_50?: number;
  rsi_14?: number;
  macd?: number;
  macd_signal?: number;
  macd_hist?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  atr_14?: number;
  vol_sma_20?: number;
  // Phase 2 (version 2+)
  stoch_k_14_3?: number;
  stoch_d_14_3?: number;
  cci_20?: number;
  williams_r_14?: number;
  adx_14?: number;
  di_plus_14?: number;
  di_minus_14?: number;
  obv?: number;
  roc_12?: number;
};

export type RankingKind = "gainers" | "losers" | "volume";

export type ListAssetsOpts = {
  limit?: number;
  offset?: number;
};

export type ListQuotesOpts = {
  limit?: number;
};

export type GetCandlesOpts = {
  timeframe: Timeframe;
  /** unix epoch seconds — 시작 (inclusive). */
  from?: number;
  /** unix epoch seconds — 끝 (exclusive). */
  to?: number;
  /** 최대 개수 — 어댑터별 상한 존재. */
  limit?: number;
};
