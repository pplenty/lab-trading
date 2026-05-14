# ADR-0019: 백테스트 엔진 (실행 위치 · 데이터 · 정확성)

- 상태: Accepted
- 날짜: 2026-05-12 (2026-05-13 ADR-0021 정합 갱신)
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0001 (스코프), ADR-0005~0007 (historical 데이터), ADR-0010 (Candle), ADR-0020 (전략 표현), ADR-0021 (저장소·지표 사전계산)

## 컨텍스트

사용자가 "백테스트 기능도 생각중이야. 일봉 기준(일봉 이상은 상관없어)"이라고 명시. 백테스트는 lab-trading의 핵심 차별화 가치 (ADR-0001).

결정해야 할 변수:

1. **실행 위치** — 브라우저 메인 스레드 / Web Worker / CF Workers / CF Durable Object
2. **데이터 fetch 위치** — 클라이언트 직접 / 서버 캐시 후 클라이언트
3. **일봉 historical 깊이** — 1년 / 5년 / 10년 / 가능한 만큼
4. **체결 모델** — 다음 봉 시가 / 같은 봉 종가 / 둘 다 옵션
5. **거래 비용** — 수수료 / 슬리피지 / 세금 (KR 거래세) 디폴트
6. **포지션 사이즈** — 100% / 분할 / 비중 조절
7. **정확성 검증** — buy-and-hold 결과를 데이터 출처와 직접 검증

## 검토한 옵션

### 실행 위치

#### EA. 브라우저 메인 스레드
- 장점: 가장 단순. 디버그 쉬움.
- 단점: 5년 일봉 (~1300개) × 룩스루 계산도 50ms 내. 큰 부담 없음. 단, 사용자가 파라미터 sweep을 100회 돌리면 UI 멈춤.

#### EB. Web Worker (browser background thread)
- 장점: UI 블로킹 회피. 파라미터 sweep 가능.
- 단점: 라이브러리/번들 분리 필요. 메시지 직렬화 비용.

#### EC. CF Workers (서버 사이드)
- 장점: 클라이언트 부담 0. 결과 캐싱 가능.
- 단점: Workers CPU 50ms 제한 (free tier). 일봉 1300개는 통과하지만 sweep은 제약. 다중 사용자 동시 실행 시 부담.

#### ED. CF Durable Object (장기 백테스트 / 큰 데이터)
- 장점: 큰 작업도 수십 초 단위 가능.
- 단점: 유료 플랜.

### 데이터 fetch

#### DA. 서버에서 일봉 fetch → 클라이언트 전달 (캐시 활용)
- 장점: API 한도 흡수. 사용자 키 노출 0.
- 단점: 백테스트 호출마다 API 비용 발생 가능 (캐시 hit이면 0).

#### DB. 클라이언트가 직접 데이터 출처 호출
- 장점: 서버 부담 0.
- 단점: API 키 노출, CORS 이슈, 한도 사용자 IP 기준.

### 일봉 깊이

| 옵션 | 코인 (Binance) | 미장 (Twelve Data) | 국내 (data.go.kr) |
|---|---|---|---|
| 1년 | 365개 | 252 거래일 | 245 거래일 |
| 5년 | 1825개 | 1260 거래일 | 1225 거래일 |
| 10년 | 3650개 | 2520 거래일 | 2450 거래일 |

코인은 자산별 상장일 이후로 한정 (BTC는 2010-, 신생 코인은 1년 미만).

## 결정

**아래 5개 결정 일괄 채택 권장:**

### 1. 실행 위치 — **EB. Web Worker (브라우저 background thread)**

근거:
- 메인 스레드 UI 응답성 유지.
- CF Workers는 다중 사용자 동시 실행 시 부담 + free tier CPU 한도 위험.
- 사용자별 격리 (DO 없이) 자연스러움.
- 파라미터 sweep / 다중 종목 비교 (Phase 2)에 확장 자연.
- 1차 출시는 메인 스레드 우선 점등 → 1.1에 Web Worker로 이전 (구현 단순화)

### 2. 데이터 fetch — **DA. 서버에서 fetch → 클라이언트 전달**

근거:
- ADR-0009의 캐시 시스템 재사용. 인기 자산의 historical은 KV에 24h 캐시 → API 호출 비용 0.
- 사용자 키 노출 회피.
- CORS 무관.

### 3. 일봉 깊이 — **기본 5년, 최대 10년 (가능한 범위)**

근거:
- 5년이 백테스트 통계적 의미가 있는 최소선 (Sharpe·MDD 계산).
- 신생 코인은 자동 short period.
- 사용자가 기간 선택 가능 (UI에 from/to date picker).

### 4. 체결 모델 — **기본 "다음 봉 시가" (next-bar open), 옵션 "같은 봉 종가"**

근거:
- next-bar open이 룩어헤드 회피 표준.
- 같은 봉 종가 옵션은 sanity check용 (실제로는 룩어헤드라 비현실적).
- 일봉 기준이라 분/초봉 시장가 슬리피지 모델은 불필요.

### 5. 거래 비용 디폴트 — **수수료 0.10%, 슬리피지 0.05%, KR 거래세 0.18% (옵션)**

근거:
- 코인 거래소 평균 수수료 0.05-0.25% 수준.
- 미장 ETF/주식 무료 거래 시대지만 슬리피지 + 시장임팩트 합치면 0.05%가 보수적.
- 한국 주식은 거래세 0.18% (코스피)·0.18% (코스닥) — 매도 시.
- 사용자 변경 가능 (Settings 또는 백테스트 폼).

### 6. 포지션 사이즈 — **1차 출시 100% 또는 0% (단일 자산, 단일 포지션)**

근거:
- 1차 출시 단순화. SMA crossover / RSI 같은 룰 기반에 충분.
- 분할 매매·비중 조절 (Kelly, fixed fraction)은 Phase 2.
- 다중 종목 포트폴리오는 Phase 3.

### 7. 지표 데이터 소스 (ADR-0021 정합) — **D1 indicators 우선, 즉석 계산 fallback**

근거:
- ADR-0021에서 SMA/EMA/RSI/MACD/BB/ATR/VolSMA 17종을 D1 `indicators` 테이블에 사전계산 저장 결정.
- 백테스트 실행 시 candles + indicators를 같은 쿼리에서 조인해 가져옴 → 같은 입력 → 같은 결과 (`computed_version` 보장).
- 사용자 정의 파라미터(예: SMA 33, RSI 9)는 사전계산에 없을 수 있음 → 클라이언트 즉석 계산 fallback.
- preset 3종(buy-and-hold/SMA(20,50)/RSI(14))의 디폴트 파라미터는 모두 D1 사전계산 컬럼과 매핑.

데이터 흐름:
```
[클라이언트 BacktestForm]
  → fetch('/api/backtest/data?class=us&symbol=aapl&from=...&to=...&strategy=sma-cross')
[Route Handler]
  → D1 SELECT candles JOIN indicators WHERE class=? AND symbol=? AND t BETWEEN ? AND ?
  → 응답: { candles[], indicators[] }
[클라이언트 runBacktest]
  → 전략의 onBar(candle, indicators[i], state, position) → 신호
  → 엔진이 체결·수수료·세금 적용
```

**잠금 인터페이스 (`lib/backtest/run.ts`):**

```ts
import type {Candle} from "@/lib/types";

export interface BacktestConfig {
  symbol: string;
  class: "crypto" | "us" | "kr";
  candles: Candle[];                    // 일봉
  indicators?: IndicatorRow[];          // ADR-0021 — D1에서 받아온 사전계산 지표 (옵션, 없으면 즉석 계산)
  strategyId: string;                   // "buy-and-hold" / "sma-cross" / "rsi"
  params: Record<string, number>;
  initialCapital: number;
  feePct: number;                       // 0.001 = 0.1%
  slippagePct: number;
  taxPctOnSell?: number;                // KR 거래세
  fillModel: "next-open" | "same-close";
  startDate?: number;                   // unix sec
  endDate?: number;
}

export interface Trade {
  side: "buy" | "sell";
  t: number;                            // 체결 시각
  price: number;
  size: number;                         // shares/coins
  cash: number;                         // 트레이드 후 현금
  equity: number;                       // 트레이드 후 자산가치
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: Array<{t: number; v: number}>;  // 자산가치 추이
  buyHoldCurve: Array<{t: number; v: number}>; // 비교 buy-and-hold
  metrics: {
    totalReturnPct: number;
    cagrPct: number;
    mddPct: number;
    sharpe: number;                     // 일간 수익 기준
    sortino: number;
    winRatePct: number;
    tradeCount: number;
    avgHoldDays: number;
  };
}

export function runBacktest(config: BacktestConfig): BacktestResult;
```

**테스트 케이스 (정확성 검증):**
- buy-and-hold 결과의 totalReturnPct가 `(끝 종가 / 시작 종가 - 1) × 100`와 일치 (수수료 제외 시).
- 동일 입력으로 100회 실행 시 동일 결과 (결정론).
- SMA crossover 골든크로스 직후 첫 매수 시각 검증.

## 결과

### 긍정적
- 사용자가 즉시 결과 (3-5초).
- 서버 비용 0 (계산은 클라이언트).
- 데이터 캐시로 API 한도 보호.
- 인터페이스 단순 — 전략 추가 비용 ↓.

### 부정적
- 클라이언트 CPU 차이로 사용자 디바이스별 응답 시간 편차. → 완화: 1300개 일봉 5년 계산은 모든 디바이스에서 50ms 내.
- 1차 출시는 메인 스레드 — UI 잠깐 멈춤 가능. → 완화: 1.1에 Web Worker로 이전. 1차는 결과 즉시 표시(50ms) + 로딩 스피너.

### 따라오는 작업
- `lib/backtest/run.ts` — 엔진 코어
- `lib/backtest/indicators.ts` — SMA / EMA / RSI / MACD (직접 구현, 0 dep)
- `lib/backtest/metrics.ts` — CAGR / MDD / Sharpe / Sortino / WinRate
- `lib/backtest/strategies/` — 1차 3 preset (buy-and-hold, sma-cross, rsi)
- 정확성 테스트 (Vitest 도입 후)
- Phase 1.1: Web Worker 마이그레이션 (`lib/backtest/worker.ts` + comlink)

## 참고

- ADR-0020 (전략 표현)
- [QuantStart - Backtesting Considerations](https://www.quantstart.com/articles/Backtesting-Strategies)
