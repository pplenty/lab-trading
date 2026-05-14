# ADR-0006: 해외 주식 데이터 소스

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0001 (스코프 — 1차는 미장 중심), ADR-0009 (캐싱)

## 컨텍스트

해외 주식(1차: 미장 NYSE·NASDAQ·AMEX, Phase 2: TSE·유럽) 시세·랭킹(gainers/losers/volume)·OHLCV(일봉)·기업 펀더멘털·뉴스를 제공해야 한다. 가장 어려운 부분은 **무료로 랭킹(gainers/losers/most-active)을 제공하는 곳이 적다**는 점.

조사 결과(2026-05-12 기준) 랭킹을 무료로 제공하는 후보:

| 후보 | 한도 | 랭킹 엔드포인트 | 글로벌 커버 | 상업적 사용 |
|---|---|---|---|---|
| **Twelve Data** | 800/day, 8/min | `/market_movers/stocks` (gainers/losers/most_actives) | **TSE+유럽+미국 90+ 거래소** | **OK** |
| **FMP** | 250/day | `/stable/biggest-gainers`, `/biggest-losers`, `/most-actives` | US 중심 | OK |
| **Polygon (Massive)** | 5/min, 15분 지연 | `/v2/snapshot/.../gainers`, `/losers` | US | OK |
| **Alpha Vantage** | 25/day, 5/min | `TOP_GAINERS_LOSERS` (Top 20 동시 반환) | US | OK |
| **Finnhub** | 60/min | **공식 movers 무료 X**, 자체 산출 필요 | US 실시간 무료 | **비상업 한정** |
| **Yahoo Finance unofficial** | 비공식 | screener (`day_gainers` 등) | 글로벌 | ToS 위반 위험 |

추가 후보(랭킹 없음, 단일 ticker):
- Tiingo (EOD 30년 무료, 펀더멘털)
- Marketstack (100 req/mo — 사실상 불가)
- EODHD (20 req/day — 불가)
- IEX Cloud (2024-08-31 종료)

## 검토한 옵션

### A. Twelve Data 단독 (조사 권장 Pattern A)
- 장점: **단일 API로 글로벌 + 랭킹 + OHLCV + 펀더멘털 모두 커버**. 무료로 상업적 사용 허용. 800/day는 KV 캐시 적극 활용 시 충분.
- 단점: 무료 plan의 글로벌 실시간이 4시간 지연(재확인 필요). 미국은 실시간 무료.

### B. Polygon + FMP + Finnhub (조사 권장 Pattern B)
- 장점: US 데이터 품질 최상 (Polygon snapshot 정확, FMP 재무제표 풍부, Finnhub 실시간).
- 단점: 어댑터 3개. Finnhub 무료가 비상업적 한정 — lab-trading은 상업 사이트라 위반 위험. 글로벌은 Twelve Data 추가 필요.

### C. Twelve Data + FMP (Twelve Data 메인 + FMP 펀더멘털 보강)
- 장점: 미국 펀더멘털(EPS·PE·재무제표·배당)이 FMP에서 훨씬 풍부. 둘 다 상업적 무료 사용 허용.
- 단점: 어댑터 2개. 단, 펀더멘털은 1차 출시 핵심 가치는 아님 (Phase 1.5+).

### D. Yahoo Finance unofficial (`yahoo-finance2`)
- 장점: 글로벌 가장 광범위, 데이터 풍부.
- 단점: **상업적 사용 ToS 위반 위험 + IP 차단 가능성**. lab-trading은 공개 상업 사이트라 의존 위험.

### E. SSG 빌드 타임 데이터 + 클라이언트 폴링 (Alpha Vantage 25/day)
- 장점: 비용 0.
- 단점: 사용자 진입 시 데이터 신선도 < 1일. "정보 사이트" 가치 명제와 충돌.

## 결정

**옵션 A 채택 권장 (Twelve Data 단독, 1차 출시).**

근거:
1. 사용자 요구 핵심인 "상승률/하락률 랭킹"이 단일 API에서 무료 + 상업적으로 제공되는 거의 유일한 선택지.
2. lab-trading의 통합 가치(코인+해외+국내)와 Twelve Data의 글로벌 커버리지(90+ 거래소) 매칭. Phase 2에 일본(TSE)/유럽 확장 시 어댑터 추가 없이 같은 어댑터에서 심볼만 추가.
3. 800/day는 한 페이지당 1-2 API 호출 + Cache TTL 60s~5min로 충분. 트래픽 100 unique/day까지는 여유.
4. Yahoo unofficial 의존을 피해서 운영 신뢰성·법적 리스크 최소화.

**잠금 항목 (1차 출시):**

| 어댑터 | 키 | 용도 | 캐시 TTL |
|---|---|---|---|
| `lib/adapters/twelve-data.ts` | `TWELVE_DATA_API_KEY` (free) | 시세·랭킹·일봉 OHLCV·기업 프로필 | 30s (시세), 5min (랭킹), 24h (EOD 백테스트 데이터) |

**Phase 1.5 / Phase 2 옵션 (1차 출시 후 결정):**
- 펀더멘털·재무제표가 필요해지면 **FMP** 추가 (`lib/adapters/fmp.ts`)
- US 실시간 정확도가 중요해지면 **Polygon snapshot** 추가
- 일본·유럽 확장 시 Twelve Data에서 심볼만 추가 (어댑터 변경 X)

**제외:**
- Yahoo Finance unofficial — 상업적 사용 ToS 위반 위험
- IEX Cloud (서비스 종료)
- Marketstack / EODHD (한도 부족)
- Finnhub (무료의 비상업 한정 조건)

## 결과

### 긍정적
- 어댑터 1개로 1차 해외 주식 운영. 가장 단순.
- 상업적 사용 명시적 허용 (Twelve Data ToS).
- 글로벌 확장 경로가 명확 (어댑터 추가 없이 심볼 추가).

### 부정적
- 무료 plan의 글로벌 4시간 지연 가능성 — 미국은 실시간이지만 EU/TSE가 어떨지 재확인 필요. → 완화: 1차 출시는 미장 중심이라 영향 적음. Phase 2 글로벌 확장 시 paid 검토.
- 800/day는 트래픽 1000 unique/day 도달 시 압박. → 완화: CF Cache + KV 적극 활용 + paid $29/mo로 5000/day 업그레이드 경로 있음.
- 펀더멘털 데이터 깊이가 FMP보다 얕음. → 완화: Phase 1.5에 FMP 추가.

### 따라오는 작업
- Twelve Data 무료 계정 가입 + API 키 발급
- `bunx wrangler secret put TWELVE_DATA_API_KEY`
- `lib/adapters/twelve-data.ts` 구현 (REST + JSON, fetch 직접)
- 푸터에 "Data: Twelve Data (link)" 표기
- 800/day 모니터링 (응답 헤더 또는 KV에 카운터)

## 참고

- background agent 조사 결과 (`ae2daa10f2e0dbd45`)
- [Twelve Data Pricing](https://twelvedata.com/pricing)
- [Twelve Data Market Movers](https://twelvedata.com/docs#market-movers)
- [FMP Biggest Gainers](https://site.financialmodelingprep.com/developer/docs/stable/biggest-gainers)
