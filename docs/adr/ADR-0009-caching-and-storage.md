# ADR-0009: 캐싱 & 스토리지

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너
- 관련 ADR: ADR-0003 (호스팅), ADR-0005~0008 (데이터 소스)

## 컨텍스트

무료 API 한도(CoinGecko Demo 30/min · 10K/mo, Twelve Data 800/day, KIS 10 req/s, RSS 5min cron 등)와 사용자 트래픽 사이의 갭을 캐시로 흡수한다. CF Workers에서 사용 가능한 스토리지 surface는 4개:

1. **Cache API** (PoP-local) — 자동 무효화 없음, fetch response 단위 캐시
2. **KV** (글로벌, eventually consistent) — 작은 키-값 (1MB), 글로벌 분산
3. **D1** (SQLite) — 관계형 데이터, 트랜잭션
4. **R2** (오브젝트) — 큰 파일·csv·과거 데이터 백업

자산군별·데이터 종류별로 TTL과 스토리지 선택을 잠근다.

## 검토한 옵션

### A. Cache API + KV 2층 (PoP local + 글로벌 폴백)
- 장점: 빠른 PoP local hit + KV로 글로벌 폴백 + stale-while-revalidate. 가장 단순.
- 단점: KV는 eventually consistent (수 초 ~ 분 단위 전파). 시세에는 충분.

### B. Cache API 단독
- 장점: 가장 단순.
- 단점: PoP 간 격리 — 한 PoP에서 첫 요청 후 외부 API 호출 1회 발생. 무료 API 한도 압박.

### C. Cache API + KV + D1
- 장점: 백테스트 historical 데이터, 사용자 전략 메타 등 관계형 저장 가능.
- 단점: 1차 출시에 D1 도입 불필요. localStorage가 사용자 데이터 대부분 커버.

### D. RSC 자체 cache (`unstable_cache` / `revalidate`)
- 장점: Next.js 표준. SSG/ISR에 자연스러움.
- 단점: `@opennextjs/cloudflare`에서 ISR은 R2 필요 (별도 ADR 필요). 시세 같은 동적 데이터엔 부적합.

## 결정

**옵션 A 채택. 1차 출시는 Cache API + KV 2층.**

근거:
1. PoP-local Cache로 cold start 비용 흡수, KV로 글로벌 폴백.
2. KV는 어댑터 단위로 키 네이밍 (`adapter:<provider>:<key>`) → 일관 invalidation 정책.
3. D1 도입은 사용자 계정·전략 클라우드 동기화 시점에 별도 ADR.

**TTL 매트릭스 (자산군 × 데이터 종류):**

| 데이터 | TTL (PoP Cache) | TTL (KV) | 비고 |
|---|---|---|---|
| 시세 ticker 단건 (crypto) | 15s | 60s | 사용자 체감 즉시성 vs API 한도 균형 |
| 시세 ticker 단건 (us, kr) | 30s | 120s | 미장/한국 거래소는 변동 polling 빈도 낮음 |
| Ticker 리스트 (자산군 전체) | 30s | 5min | 대시보드 카드 위젯 |
| 랭킹 (gainers/losers/volume) | 60s | 5min | 사용자 체감 ↓하지만 시각적 일관성 ↑ |
| 일봉 OHLCV — 오늘 봉 | 60s | 5min | 종가는 장 마감 후 확정 |
| 일봉 OHLCV — 과거 봉 | 24h | 7day | 사실상 불변 (수정주 발생 시만 invalidate) |
| 종목 메타 (이름·로고·설명) | 24h | 7day | |
| 공시·재무 (DART) | 6h | 24h | 신규 공시 빈도 고려 |
| 뉴스 (RSS) | 5min | 5min | Cron 트리거로 KV 갱신 |
| 환율 (USD↔KRW) | 5min | 1h | 화면 통화 변환용 |

**KV 키 네이밍:**
```
adapter:<provider>:<endpoint>:<params hash>
예: adapter:coingecko:markets:vs_currency=usd|order=mcap_desc|page=1
   adapter:upbit:ticker:markets=KRW-BTC
   adapter:binance:klines:symbol=BTCUSDT|interval=1d|limit=1825
   adapter:twelve-data:movers:type=gainers
```

**Stale-while-revalidate 패턴:**
- KV hit (stale 포함) → 즉시 반환 + 백그라운드 재페치
- KV miss → 외부 API 호출 + Cache + KV에 set
- 외부 API 429/5xx → 마지막 stale 값 반환 (KV에 저장된 최신 성공값)

**Cache API 키:**
- Workers `caches.default.match(request)` 직접 사용
- response의 `Cache-Control` 헤더로 TTL 제어 (예: `s-maxage=60, stale-while-revalidate=300`)

## 결과

### 긍정적
- 무료 API 한도 흡수 — CoinGecko Demo 10K/mo로 1000 unique/day까지 운영 가능.
- 글로벌 PoP 활용으로 한국·미주 사용자 모두 빠른 응답.
- Stale-while-revalidate로 API 다운 시에도 화면 공백 회피.

### 부정적
- KV eventually consistent — PoP 간 데이터 불일치 가능성 (수 초 ~ 분). → 완화: 시세에는 영향 미미. 백테스트 데이터는 24h 캐시라 전파 충분.
- 트래픽 매우 적은 초기엔 Cache miss가 잦아 첫 사용자가 KV 조회 + 외부 API 부담. → 완화: 대시보드용 인기 자산은 cron(5min)으로 사전 페치.

### 따라오는 작업
- `wrangler.jsonc`에 KV namespace 바인딩 추가 (`LAB_KV`)
- `lib/cache/edge.ts` — Cache API 래퍼 (`getCached`, `setCached`)
- `lib/cache/kv.ts` — KV 래퍼 (stale-while-revalidate 포함)
- `lib/cache/ttl.ts` — 위 매트릭스 상수
- 어댑터마다 cache 키 함수 명시
- Phase 2: cron 사전 페치 워커

## 참고

- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Stale-while-revalidate pattern](https://web.dev/articles/stale-while-revalidate)
