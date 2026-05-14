# ADR-0024: 통화 표시 · 환율 처리

- 상태: Accepted
- 날짜: 2026-05-13
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 약함)
- 관련 ADR: ADR-0010 (데이터 모델 — currency), ADR-0009 (캐시)

## 컨텍스트

3 자산군의 호가 통화가 다르다:

| 자산군 | 호가 통화 | 비고 |
|---|---|---|
| 코인 (Upbit) | KRW | 한국 사용자 익숙 |
| 코인 (Binance) | USDT (≈USD) | 글로벌 표준 |
| 코인 (CoinGecko) | USD 기본, 통화 변환 옵션 | 집계 데이터 |
| 미장 | USD | 무조건 |
| 국내 | KRW | 무조건 |

한국 사용자는 USD 종목을 KRW로 환산해서 보고 싶어 할 수 있고(또는 그 반대). 표시 통화 정책과 환율 데이터 소스가 필요.

## 검토한 옵션

### 표시 통화 정책

#### A. 호가 통화 그대로 (변환 없음)
- 장점: 단순. 정확.
- 단점: AAPL을 KRW로 보고 싶은 사용자 불편.

#### B. 단일 표시 통화 강제 (사용자가 KRW 선택 시 모든 가격 KRW)
- 장점: 일관성.
- 단점: 호가 통화가 사라져 사용자가 "이게 원본인가 변환인가" 혼란.

#### C. **호가 + 보조 변환 (예: "$150.00 (≈ ₩201,000)") + 사용자 토글로 우선순위 전환**
- 장점: 원본 + 변환 둘 다. 사용자가 디폴트 표시 결정.
- 단점: 줄 길이 ↑.

### 환율 데이터 소스

| 후보 | 무료 한도 | 인증 | 쌍 |
|---|---|---|---|
| **한국은행 ECOS API** | 무료 (1만 calls/day) | 키 (이메일 가입) | USD/KRW 공식 |
| Frankfurter (frankfurter.app) | 무료 무제한 | 없음 | ECB 32 통화 |
| ExchangeRate-API | 1500/mo (free) | 키 | 161 통화 |
| Open Exchange Rates | 1000/mo (free) | 키 | 200+ 통화 |
| CoinGecko `/simple/price` | API 한도 공유 (ADR-0005) | demo key | crypto + fiat 변환 |
| Frankfurter (no key) | 무료 | 없음 | 30 통화 |

## 결정

**옵션 C 채택 + 환율 소스는 Frankfurter (1차) → 한국은행 ECOS (Phase 1.5+).**

근거:
1. 표시 통화 — 호가 + 보조 변환 동시 노출이 정보 손실 0. yutils 사용자 가독성 패턴과 정합.
2. 환율 — Frankfurter는 무인증·무료·무제한·CORS OK·ECB 기준. 1차 출시에 가장 단순.
3. Phase 1.5에 한국은행 ECOS 추가 — 한국 공식 매매기준율 (외환 차원의 신뢰성 ↑).

**잠금 항목:**

### 사용자 설정 (`Settings`, localStorage 키 `lab-trading-currency-display`)

| 값 | 동작 |
|---|---|
| `native` (디폴트) | 호가 통화 우선 표시. KRW 종목은 "₩70,000", USD 종목은 "$150.00 (≈ ₩201,000)" |
| `krw` | KRW 우선. USD 종목 "₩201,000 (≈ $150.00)" |
| `usd` | USD 우선. KRW 종목 "$52.50 (≈ ₩70,000)" |

### 환율 어댑터 (`lib/adapters/fx.ts`)

```ts
export interface FxRate {
  from: string;
  to: string;
  rate: number;
  asOf: string;        // ISO date
  source: string;
}

export interface FxAdapter {
  rate(from: string, to: string): Promise<FxRate>;
  rates(base: string): Promise<Record<string, number>>;
}
```

**1차 어댑터:**
- `lib/adapters/frankfurter.ts` — `https://api.frankfurter.app/latest?from=USD&to=KRW`
- Cache TTL: 5min (PoP) / 1h (KV)
- ECB는 영업일 16:00 CET에 갱신 — 한국 자정 즈음. 한국 사용자 morning 새로고침 시 최신 값.

**Phase 1.5 추가:**
- `lib/adapters/ecos.ts` — 한국은행 ECOS API (USD/KRW 매매기준율)
- 한국은행이 영업일 09:30에 고시. ECB와 영업일 한 봉 차이 가능.

### 컴포넌트 (`components/Price.tsx`)

```tsx
<Price value={150} currency="USD" />
// 사용자 설정에 따라 자동 형태:
// native: "$150.00 (≈ ₩201,000)"
// krw:    "₩201,000 (≈ $150.00)"
// usd:    "$150.00"  (보조 표시 생략 — 같은 통화)
```

내부:
- `useFxRate(from, to)` hook — SWR로 5min 자동 갱신
- 환율 fetch 실패 시 보조 표시 숨김 (호가 통화만 노출)
- `Intl.NumberFormat`으로 통화별 자릿수·기호

### 환율 출처 표기 (ADR-0017)

- Settings 페이지 + 보조 통화 표시 hover tooltip: `환율: Frankfurter (ECB 기준) · 갱신 N분 전`
- Phase 1.5: `환율: 한국은행 매매기준율 · 갱신 N분 전`

### 차트·백테스트 통화

- **차트**: 호가 통화 그대로 (변환하면 y축 의미 흐려짐).
- **백테스트 초기 자본**: 호가 통화 자동 (코인 KRW 페어 = ₩1,000,000, BTCUSDT = $1,000, AAPL = $1,000, 005930 = ₩1,000,000). 사용자 변경 가능.
- **다중 자산 비교 (Phase 2)**: 비교 시점에 base currency로 환산.

## 결과

### 긍정적
- 한국 사용자가 미장 종목 KRW 환산 즉시 확인.
- 호가 + 변환 동시 노출로 정보 손실 0.
- 환율은 무료·합법 출처.

### 부정적
- 줄 길이 ↑ — 모바일 카드에서 두 줄 차지. → 완화: 카드는 호가 통화만, 종목 상세에서 두 통화 노출.
- 환율 fetch 추가 ~5min 폴링. → 완화: KV 캐시. Workers Cron으로 사전 페치 가능.

### 따라오는 작업
- `lib/adapters/frankfurter.ts`
- `components/Price.tsx`
- `useFxRate` hook + `lib/cache/edge.ts` 활용
- `Settings`에 통화 표시 라디오
- Phase 1.5: `lib/adapters/ecos.ts` + 한국은행 ECOS 키 발급 (`ECOS_API_KEY`)
- 차트 컴포넌트는 호가 통화 lock

## 참고

- [Frankfurter API](https://www.frankfurter.app/docs/)
- [한국은행 ECOS API](https://ecos.bok.or.kr/api/)
- [Intl.NumberFormat — currency](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
