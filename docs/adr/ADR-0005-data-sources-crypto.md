# ADR-0005: 코인 데이터 소스

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0009 (캐싱), ADR-0017 (출처 표기)

## 컨텍스트

코인 시세·랭킹·OHLCV(일봉)·시가총액·24h 변동률을 제공해야 한다. 사용자는 한국 사용자 우선이므로 KRW 페어가 필수. 백테스트는 일봉 historical을 5년 이상 받아올 수 있어야 한다. CF Workers에서 fetch만으로 호출 가능해야 한다.

조사 결과(2026-05-12 기준):

| 후보 | 한도 | 인증 | 강점 |
|---|---|---|---|
| CoinGecko Demo (free) | 30/min, 10K/mo | x-cg-demo-api-key | 600+ 거래소 집계, 글로벌 랭킹·OHLC·메타데이터 |
| CoinGecko Public (no key) | 5-15/min (IP, 변동) | 없음 | 위와 동일하나 한도 불안정 |
| Upbit Quotation | ~10 req/s (재확인) | 없음 (시세) | **KRW 페어 1순위** |
| Binance Public | weight 6000/min | 없음 | 글로벌 무한 RPS, 모든 알트 OHLCV |
| CoinPaprika | 20K/mo | 없음 (Pro만 키) | 페일오버 후보 |
| Bithumb Public | 미공개 | 없음 | Upbit 백업 |
| CoinMarketCap Basic | 50/min, 15K credit/mo | X-CMC_PRO_API_KEY | **무료는 비상업적 한정** |
| DefiLlama | 500/5min | 없음 | DeFi TVL/체인별 — 시세 메인 X |

## 검토한 옵션

### A. CoinGecko Demo + Upbit + Binance (조사 권장 Pattern A)
- 장점: 키 관리 1개(CoinGecko Demo)만, KRW + 글로벌 모두 커버, 모두 무료, fetch만으로 호출 가능, 상업적 사용 명시적 허용 (CoinGecko는 "powered by" 링크 필수).
- 단점: 3개 어댑터 운영. 어댑터 간 심볼 정규화 필요 (BTC, BTCUSDT, KRW-BTC).

### B. CoinGecko 단독
- 장점: 가장 단순. 어댑터 1개.
- 단점: KRW 호가는 통화 변환된 값이라 한국 사용자가 보는 Upbit/Bithumb 실제 가격과 약간 차이 발생. 거래량은 글로벌 집계라 한국 거래소 단독 수치와 다름.

### C. CoinMarketCap 단독
- 장점: 단일 API, 한도 명확.
- 단점: **무료는 비상업적 한정** — lab-trading은 공개 commercial 사이트라 ToS 위반 위험.

### D. Binance + Upbit 단독 (CoinGecko 미사용)
- 장점: 거래소 직접이라 데이터 정확. 키 관리 0.
- 단점: 시가총액·코인 메타데이터(설명·로고·카테고리) 없음. 글로벌 랭킹(상승률) 도출하려면 모든 페어 fetch 필요.

### E. CryptoCompare + Upbit
- 장점: 100K calls/mo 풍부, 분 7일+일 무제한 historical.
- 단점: 무료 키의 상업적 사용 조건 재확인 필요. 한국 거래소 커버 약함.

## 결정

**옵션 A 채택 권장.**

근거:
1. CoinGecko Demo의 30/min × 10K/mo는 CF Cache + KV로 캐싱하면 대시보드·랭킹·종목 메타에 충분. 시가총액 랭킹 등 **글로벌 집계 데이터의 절대 1순위**.
2. Upbit는 한국 사용자의 익숙한 KRW 가격을 그대로 제공. 시세 데이터의 화면 1차 노출은 KRW 사용자에게 Upbit가 가장 자연스러움.
3. Binance는 거래소 직접이고 weight 한도가 사실상 무한. 일봉 OHLCV 백테스트 데이터의 메인 소스 (BTC 5년+ historical 자유).
4. DefiLlama는 1차 출시에서 제외. DeFi 카테고리는 Phase 2.

**잠금 항목 (1차 출시):**

| 어댑터 | 키 | 용도 | 캐시 TTL |
|---|---|---|---|
| `lib/adapters/coingecko.ts` | `COINGECKO_API_KEY` (Demo) | 시가총액 랭킹·코인 메타·24h 변동률·로고 URL·상승/하락/거래량 랭킹 | 60s (ticker), 5min (랭킹), 24h (메타·로고) |
| `lib/adapters/upbit.ts` | 없음 | KRW 페어 시세·일봉·캔들 (한국 사용자 디폴트 표시) | 30s (ticker), 1h (일봉 historical) |
| `lib/adapters/binance.ts` | 없음 | 글로벌 페어 시세·일봉 historical (백테스트 데이터 주력) | 30s (ticker), 1h (일봉 historical) |

**페일오버:** CoinGecko 응답이 비정상 또는 429일 때 **stale-while-revalidate** — KV의 마지막 성공값을 반환하면서 백그라운드에서 재시도.

**제외:**
- CoinMarketCap (상업적 사용 위반 위험)
- TradingView/네이버/다음 unofficial (ToS 위반 위험, 1차에서는 사용 안 함)
- DefiLlama (Phase 2)

## 결과

### 긍정적
- 어댑터 추상화 검증: 같은 `DataAdapter` 인터페이스에 3개 구현체가 모두 깔끔하게 맞으면 ADR-0006(해외주식) 어댑터 추가가 자연스럽다.
- 1차 출시 데이터 운영 비용 0원.
- KRW 페어 가격은 사용자가 익숙한 Upbit 가격과 정확히 일치.

### 부정적
- 어댑터별 심볼 정규화 비용 (`BTCUSDT` ↔ `bitcoin` ↔ `KRW-BTC`). → 완화: `lib/symbols/normalize.ts`에 단일 매핑 테이블 (ADR-0010).
- CoinGecko Demo 한도(10K/mo)는 트래픽 폭증 시 부족할 수 있음. → 완화: 캐시 적극적 활용 + 트래픽 1000 unique visitor/day 도달 시 Pro 플랜 검토.
- Workers 다중 PoP의 출구 IP가 동일 ASN으로 묶일 수 있어 Upbit/Binance의 IP 기반 한도 모니터링 필요. → 완화: 429 응답 모니터링 + circuit breaker.

### 따라오는 작업
- `bunx wrangler secret put COINGECKO_API_KEY` (Demo 키 발급 후)
- `lib/adapters/coingecko.ts` / `upbit.ts` / `binance.ts` 구현
- `lib/cache/edge.ts` + `lib/cache/kv.ts` 캐시 래퍼 (ADR-0009 확정 후)
- 푸터에 "Data: CoinGecko (link) · Upbit · Binance" 표기 (ADR-0017)
- 429/스테일 캐시 모니터링 셋업 (Phase 2)

## 참고

- background agent 조사 결과 (`af999dc8ce3dc49e7`)
- [CoinGecko API Terms](https://www.coingecko.com/en/api_terms)
- [Upbit Open API Rate Limits](https://global-docs.upbit.com/reference/rate-limits)
- [Binance Spot API Limits](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/limits)
