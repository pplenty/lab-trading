// 공통 데이터 타입 (ADR-0010).
// 자산군 · 어댑터 · 페이지 · 백테스트 모두 이 타입만 import 한다.
// 어댑터별 raw 응답은 어댑터 내부에서 normalize 해 이 타입으로 변환.

export type AssetClass = "crypto" | "us" | "kr";

export type Asset = {
  class: AssetClass;
  /** normalize 된 사이트 내부 슬러그 — `crypto/btc`, `us/aapl`, `kr/005930` 등 */
  symbol: string;
  /** 거래소 공식 티커 (어댑터별 원본) */
  ticker: string;
  /** 종목 정식명 (원본 데이터의 표기 그대로 — 번역 X, 컨벤션 G) */
  name: string;
  /** 현지 통화 코드 (`USD`, `KRW`, etc) — 코인은 베이스 자산 기준 보조 */
  currency: string;
};

export type Quote = {
  symbol: string;
  price: number;
  /** 24h 변동률 (%, 부호 포함, 0.0123 = +1.23%) — UI 에서 *100 후 toFixed(2) */
  changePct: number;
  volume: number;
  /** unix epoch seconds, UTC. 표시 시점에 Intl.DateTimeFormat 변환 */
  updatedAt: number;
};

export type Candle = {
  /** unix epoch seconds, UTC. 일봉이면 거래일 00:00 KST 또는 거래소 표준 시점 */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

/** ADR-0021 indicators 사전계산. wide format — candles 와 1:1 매핑 (t 가 PK). */
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
};

export type RankingKind = "gainers" | "losers" | "volume";

export type ListOpts = {
  /** 결과 최대 개수 — 어댑터별 상한 존재. 기본 50, 최대 100 (1차 출시). */
  limit?: number;
  /** 페이지네이션 (어댑터 지원 시) */
  cursor?: string;
};

export type CandleOpts = {
  /** unix epoch seconds — 시작 (inclusive). */
  from: number;
  /** unix epoch seconds — 끝 (exclusive). */
  to: number;
  /** 시간 단위 — 1차 출시는 `1d` 만 활성. `1w` / `1mo` 는 backfill 후 활성 (ADR-0019). */
  tf: "1d" | "1w" | "1mo";
};
