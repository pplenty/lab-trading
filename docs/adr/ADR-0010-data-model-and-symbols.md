# ADR-0010: 데이터 모델 · Symbol 정규화

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너
- 관련 ADR: ADR-0005~0007 (데이터 소스), ADR-0019 (백테스트)

## 컨텍스트

3 자산군 × 6 어댑터(CoinGecko, Upbit, Binance, Twelve Data, KIS, KRX, OpenDART)가 같은 페이지를 공유하므로, 공통 추상 모델 + 어댑터별 → 공통 모델 정규화가 필요하다. 특히 심볼 표기가 어댑터마다 다르다:

- 비트코인: `BTC` (Twelve Data) / `bitcoin` (CoinGecko) / `KRW-BTC` (Upbit) / `BTCUSDT` (Binance)
- 삼성전자: `005930` (KIS) / `005930.KS` (Yahoo) / `005930` (KRX)
- 애플: `AAPL` (모든 미장 API)

각 데이터 종류의 필드 셋도 어댑터마다 다르다 (CoinGecko는 시가총액 제공, Binance는 페어 거래량만).

## 검토한 옵션

### A. 공통 `Asset` / `Quote` / `Candle` 인터페이스 + 어댑터별 normalize 함수
- 장점: 페이지 컴포넌트가 어댑터를 모름. 어댑터 교체·추가 비용 ↓.
- 단점: 공통 인터페이스에 못 들어가는 자산군 고유 필드 (코인의 `circulating_supply`, 주식의 `pe_ratio`)는 별도 처리 필요.

### B. 어댑터별 원본 형태 그대로 노출
- 장점: 단순. 정규화 비용 0.
- 단점: 페이지·차트·백테스트 코드가 어댑터에 결합. 어댑터 교체 시 페이지 코드 수정.

### C. GraphQL 또는 tRPC 추상
- 장점: 타입 안전.
- 단점: 1차 출시에 과한 추상화. Workers에서 tRPC는 동작하지만 부트 비용.

## 결정

**옵션 A 채택.**

**공통 인터페이스 (`lib/types.ts`):**

```ts
export type AssetClass = "crypto" | "us" | "kr";

// 정규화된 lab-trading 심볼 — URL과 KV 키에 모두 사용
// 형식:
//   crypto: <ticker>           예: btc, eth, sol, doge
//   us:     <ticker>           예: aapl, tsla, nvda
//   kr:     <6자리 코드>        예: 005930, 035720
export type Symbol = string;

// 자산 메타 (정적)
export interface Asset {
  class: AssetClass;
  symbol: Symbol;             // 정규화 심볼 (URL용)
  name: string;               // 원본 정식명 (예: "Apple Inc.", "삼성전자")
  nameKo?: string;            // 한글 표기 (있을 때만)
  ticker?: string;            // 거래소 ticker (예: AAPL, 005930)
  logoUrl?: string;
  description?: string;
  market?: string;            // 예: "NASDAQ", "KOSPI", "KRW"
  currency: string;           // ISO 4217 (USD, KRW, USDT)
  isin?: string;
  cmcId?: number;             // crypto only
  cgId?: string;              // crypto only (CoinGecko id)
}

// 시세 스냅샷
export interface Quote {
  symbol: Symbol;
  class: AssetClass;
  price: number;              // currency 단위
  currency: string;
  changePct24h: number;       // -3.5 = -3.5%
  changeAbs24h?: number;
  volume24h?: number;         // currency 단위 거래대금 (또는 base 단위 — 어댑터 명시)
  high24h?: number;
  low24h?: number;
  marketCap?: number;         // crypto/us 일부
  rank?: number;              // 시가총액 순위 (crypto)
  updatedAt: string;          // ISO 8601
  source: string;             // 어댑터 식별자 ("coingecko", "upbit", "binance", "twelve-data", "kis")
}

// 일봉 캔들 (백테스트·차트 공통)
export interface Candle {
  t: number;                  // unix epoch (seconds), UTC 자정 기준
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// 일봉 시리즈
export interface CandleSeries {
  symbol: Symbol;
  class: AssetClass;
  currency: string;
  timeframe: "1d" | "1w" | "1mo";
  candles: Candle[];
  source: string;
  cachedAt: string;
}

// 어댑터 인터페이스
export interface DataAdapter {
  readonly id: string;        // "coingecko" / "upbit" / "binance" / "twelve-data" / "kis" / "krx" / "opendart"
  readonly classes: AssetClass[];

  listAssets(opts?: {limit?: number; offset?: number}): Promise<Asset[]>;
  getAsset(symbol: Symbol): Promise<Asset | null>;

  getQuote(symbol: Symbol): Promise<Quote>;
  listQuotes(opts?: {limit?: number}): Promise<Quote[]>;

  getCandles(symbol: Symbol, opts: {
    timeframe: "1d" | "1w" | "1mo";
    from?: number;            // unix sec
    to?: number;
    limit?: number;
  }): Promise<CandleSeries>;

  // 일부 어댑터만 구현 (capability flag)
  rankings?(kind: "gainers" | "losers" | "volume", opts?: {limit?: number}): Promise<Quote[]>;
}
```

**Symbol 정규화 정책:**

- **crypto**: lowercase ticker만 (예: `btc`, `eth`). 페어가 다른 거래소는 어댑터 내부에서 매핑.
  - URL: `/crypto/btc`
- **us**: lowercase ticker (예: `aapl`, `tsla`).
  - URL: `/us/aapl`
- **kr**: 6자리 코드 그대로 (예: `005930`).
  - URL: `/kr/005930`

**어댑터별 매핑 테이블** (`lib/symbols/registry.ts`):
```ts
// 핵심 종목만 명시 매핑. 그 외는 어댑터의 listAssets로 동기화.
export const cryptoRegistry = {
  btc: {coingeckoId: "bitcoin", binancePair: "BTCUSDT", upbitMarket: "KRW-BTC"},
  eth: {coingeckoId: "ethereum", binancePair: "ETHUSDT", upbitMarket: "KRW-ETH"},
  // ...
};
```

**자산군 confusion 방지:** 같은 ticker가 자산군 간 충돌 가능 (예: `BTC`는 코인이지만 미장에 BTC.A 같은 심볼이 있을 수도). URL에 자산군 prefix가 있어 충돌 0.

## 결과

### 긍정적
- 페이지·차트·백테스트 코드가 어댑터를 모름. 어댑터 교체 비용 ↓.
- URL 안정성 (slug 변경 시 301만 추가).
- TypeScript strict로 타입 누락 컴파일 단계에서 잡힘.

### 부정적
- 어댑터별 normalize 함수 작성 비용. → 완화: 인터페이스가 단순해서 어댑터당 ~150줄.
- Asset 인터페이스에 못 들어가는 자산군 특화 필드는 `meta: Record<string, unknown>` 또는 별도 인터페이스 확장. → 정책: 자산군 특화 필드는 `Asset` 확장 (`CryptoAsset extends Asset { cgId?, circulatingSupply? }`).

### 따라오는 작업
- `lib/types.ts` — 위 인터페이스 정의
- `lib/symbols/registry.ts` — 핵심 종목 매핑
- `lib/symbols/normalize.ts` — `toSymbol(raw: string, class: AssetClass): Symbol`
- 어댑터마다 `normalizeQuote`, `normalizeAsset`, `normalizeCandle` 헬퍼

## 참고

- ADR-0005~0007 (어댑터별 원본 형태)
