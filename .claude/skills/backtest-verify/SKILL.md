---
name: backtest-verify
description: lab-trading 의 백테스트 정합성을 종합 검증한다. 룩어헤드 / indicator 수학적 정확성 / 메트릭 (CAGR/Sharpe/MDD) / 수수료·슬리피지 / 분할조정 / 자본 가드 6 영역 체크리스트. 새 strategy preset / indicator / 메트릭 변경 후 의무. "백테스트 정합성", "Sharpe 검증", "indicator 정확성", "룩어헤드 점검" 등 트리거. backtest-validator 위임.
---

# backtest-verify — 백테스트 정합성 종합 검증

## 트리거

- "백테스트 정합성 점검", "Sharpe 정확한가?", "MDD 검증"
- "indicator 수학 정합", "RSI/MACD/Stoch 정확성"
- "룩어헤드 의심", "다음 봉 시가 체결 검증"
- 새 strategy preset 추가 (sma-crossover / rsi-mean-reversion / macd-signal 등)
- 새 indicator 추가 (ADR-0021 의 26 컬럼 확장)
- 백테스트 결과가 직관과 어긋날 때

## 모드

### Quick (PR마다, 1-2분)

변경된 strategy / indicator 만 회귀 검증:
- 룩어헤드 단언 (assertNoLookahead)
- 표준 reference 데이터셋 대비 5 decimal place 정합
- 핵심 메트릭 (CAGR / Sharpe / MDD / WIN rate) 단위 테스트

### Standard (월 1회, 10-15분)

26 indicator + 모든 strategy preset 회귀:
- 표준 reference dataset (TradingView/stockcharts) 정합 검증
- BTC/USDT 1년 + AAPL 1년 + 005930 1년 (3 자산군 control)
- buy-and-hold vs preset 비교 sanity check
- 수수료·슬리피지 양방향 적용 검증

### Comprehensive (분기 1회, 30-60분)

walk-forward 4 기간 검증 (Trader [[Patterns/Walk-Forward 가 best 의 거짓말을 폭로한다]] 패턴 차용):
- 4mo / 6mo / 12mo / 24mo 분할
- in-sample vs out-of-sample Sharpe 비교
- best 가 over-fitting 인지 정량 단언

## 검증 영역 (체크리스트)

### 1. 룩어헤드 (Look-ahead) 금지

```ts
test("preset X — 룩어헤드 없음", () => {
  const fakeStrategy = wrapWithLookaheadDetector(presets[X]);
  runBacktest({ preset: fakeStrategy, candles });
  expect(fakeStrategy.lookaheadDetected).toBe(false);
});
```

봉 종가까지만 onBar 에 전달, 다음 봉은 진입 시점에만 시가 사용.

### 2. Indicator 수학적 정확성

각 26 indicator 의 표준 reference 정합:

```ts
test("RSI(14) TradingView 정합", () => {
  const result = computeRSI(STANDARD_CANDLES, 14);
  // STANDARD_CANDLES 는 TradingView 또는 stockcharts.com 의 공개 데이터
  expect(result[100]).toBeCloseTo(REFERENCE_RSI_VALUES[100], 4);
});
```

표준 데이터셋:
- `test/fixtures/sp500-2020.json` (S&P 500, 252 일)
- `test/fixtures/btc-2023.json` (BTC/USDT, 365 일)
- `test/fixtures/005930-2022.json` (삼성전자, KOSPI 영업일)

### 3. 메트릭 정확성

```ts
test("Sharpe — buy-and-hold SP500 2020 정합", () => {
  const result = runBacktest({ preset: "buy-and-hold", candles: SP500_2020 });
  expect(result.sharpe).toBeCloseTo(0.65, 2);  // 2020 COVID 폭락 + 회복
  expect(result.cagr).toBeCloseTo(0.16, 2);
  expect(result.mdd).toBeCloseTo(-0.34, 2);
});

test("annualized factor — 자산군별", () => {
  // 코인 = 365, 주식 = 252
  const cryptoResult = runBacktest({ asset: "crypto", ... });
  const stockResult = runBacktest({ asset: "us", ... });
  // factor 차이 → annualized Sharpe 도 다름 (같은 daily return 이라도)
});
```

### 4. 수수료 + 슬리피지

```ts
test("수수료 양방향 적용", () => {
  const result = runBacktest({ commission: 0.001, slippage: 0.0005, ... });
  const trade = result.trades[0];
  // 매수: entry × (1 + slippage + commission)
  // 매도: exit × (1 − slippage − commission)
  expect(trade.entryEffectiveCost).toBeGreaterThan(trade.entry);
  expect(trade.exitEffectiveReceived).toBeLessThan(trade.exit);
});

test("KR 거래세 0.18% — 매도만", () => {
  const result = runBacktest({ asset: "kr", krTransactionTax: true, ... });
  // 매도 시점만 추가 cost
});
```

### 5. 분할조정

```ts
test("삼성전자 50:1 split (2018) 처리", () => {
  // split-adjusted close 사용
  const candles = await krAdapter.getCandles("005930", { from: "2017-01-01", to: "2019-12-31" });
  // 2018-05-04 (분할 직전) close vs 2018-05-04 (분할 직후) close
  // → split-adjusted 면 연속 (jump 없음)
  const prevSplit = candles.find(c => c.t === SPLIT_DAY_PREV);
  const postSplit = candles.find(c => c.t === SPLIT_DAY_POST);
  const ratio = postSplit.c / prevSplit.c;
  expect(Math.abs(ratio - 1)).toBeLessThan(0.1);  // 분할 직전후 ±10% 이내
});
```

### 6. 자본 가드

```ts
test("equity ≤ 0 시 백테스트 중단", () => {
  const result = runBacktest({ initial: 1000, preset: "aggressive-leverage-stub", ... });
  expect(result.bankrupted).toBe(true);
  expect(result.trades.length).toBeLessThan(allCandles.length);  // 청산 후 미진입
});

test("자본 부족 진입 skip", () => {
  const result = runBacktest({ initial: 100, candles: HIGH_PRICE_CANDLES, ... });
  expect(result.trades.filter(t => t.skipped === "insufficient_capital").length).toBeGreaterThan(0);
});
```

## 회귀 안전망

`lib/backtest/__tests__/regression.test.ts` 에 다음 단언 의무:

```ts
// 새 strategy 추가 시 매번 추가
test("RsiMeanReversion — golden number SP500 2020", () => {
  const result = runBacktest({ preset: "rsi-mean-reversion", candles: SP500_2020, ... });
  // golden number 박제 — 변경 시 의도된 결과인지 확인 후 갱신
  expect(result.cagr).toBeCloseTo(GOLDEN.rsiMeanReversion.cagr, 4);
});
```

`backtest-validator` 가 매 PR 마다 golden number 갱신 사유 검증.

## 산출물

- Vitest 단위 테스트 추가 (영역당 5+ 케이스)
- `_workspace/backtest-verify-<date>.md` 리포트:
  - 영역별 통과 / 실패 표
  - golden number 변경 이력
  - over-fitting 정량 측정 (walk-forward 모드만)
- 회귀 발견 시 GitHub issue + ADR 후보

## 거부 패턴

- ❌ "이 백테스트 결과 좋아 보이니까 배포" — 정합성 검증 없이 신뢰
- ❌ Sharpe / MDD 의 절대값만 보고 평가 (in-sample optimization 함정)
- ❌ 표준 reference 없이 indicator 검증 (자체 산출 = 자체 검증)
- ❌ KR 자산을 코인 annualized factor (365) 로 산출

## 관련 자산

- 에이전트: `backtest-validator`
- ADR-0019 / 0020 / 0021 / 0025
- [[Patterns/Walk-Forward 가 best 의 거짓말을 폭로한다]] (Trader 차용)
- [[Patterns/Multi-strategy 자본 공유 dilution]] (Trader, Phase 2+ 다중 종목 시)
