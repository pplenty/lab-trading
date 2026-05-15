# RUN_PLAYBOOK — 운영 점검 가이드

> lab-trading 운영 시 자주 일어나는 작업·장애 대응의 표준 절차.
> 1차 출시 후 첫 6개월 운영 가이드. 사용 패턴이 정착되면 ADR로 정형화.

## 출시 전 체크리스트

### D-7 (출시 1주일 전)

- [ ] 모든 ADR(0000-0025) 상태가 `Accepted` (DECISIONS.md 답변 반영 완료)
- [ ] CLAUDE.md 변경 이력 최신 (1차 출시 시점 행 추가)
- [ ] CF Workers 배포 환경 정상 (`bunx wrangler whoami` OK)
- [ ] D1 namespace 생성 + binding (`wrangler d1 create lab-trading-db`)
- [ ] KV namespace 생성 + binding
- [ ] R2 bucket 생성 + binding (`wrangler r2 bucket create lab-trading-backup`)
- [ ] 외부 API 키 모두 발급 + `wrangler secret put`:
  - `COINGECKO_API_KEY`
  - `TWELVE_DATA_API_KEY`
  - (Phase 1.5에 KIS/KRX/DATA_GO_KR/OPENDART 추가)
- [ ] 환율 어댑터(Frankfurter) fetch 테스트 OK
- [ ] 데이터 어댑터 매트릭스 — 각 어댑터당 1개 종목 fetch 성공:
  - CoinGecko: BTC quote + 시가총액
  - Upbit: KRW-BTC ticker
  - Binance: BTCUSDT klines 1d
  - Twelve Data: AAPL quote + day_gainers
- [ ] 백테스트 sanity check — BTC buy-and-hold 결과의 totalReturnPct가 `(끝가/시작가 - 1)*100`과 일치 (수수료 제외)
- [ ] 지표 cross-check — 인기 종목 10개 × 100봉 SMA20/RSI14가 TradingView UI 값과 ±0.1% 이내 일치
- [ ] Lighthouse 모바일 점수 80+ (Performance/SEO/Accessibility)
- [ ] 종목 상세 페이지 JS payload 250KB gzip 이하
- [ ] 면책 + 데이터 출처 푸터 모든 페이지 노출
- [ ] sitemap.xml + robots.txt 정상

### D-1 (출시 전날)

- [ ] `bun run cf:build` 통과 (warnings 검토)
- [ ] `bun run cf:preview` 로컬 Workers 시뮬레이션 정상
- [ ] CF Web Analytics 사이트 등록 + beacon script 활성
- [ ] CF Workers Logs / Tail Worker 활성화 (Logpush → R2 옵션)
- [ ] 도메인 `trading.jdgrid.com` DNS CNAME OK
- [ ] HTTPS 인증서 유효 (CF auto)
- [ ] 404 페이지 동작
- [ ] OG image 1차 (정적 또는 default) 노출

### D-0 (출시일)

- [ ] `bun run cf:deploy` 배포
- [ ] 배포 직후 5분간 Workers Logs 모니터링
- [ ] 주요 페이지 5개 수동 확인 (대시보드 / crypto 인덱스 / BTC 상세 / us 인덱스 / 백테스트)
- [ ] CF Analytics 대시보드 트래픽 발생 확인
- [ ] 외부 API 응답 헤더의 한도 잔량 확인 (Analytics Engine push)

## 일상 운영

### 매일 (자동 cron)

| 작업 | 시각 (UTC) | Worker | 설명 |
|---|---|---|---|
| 인기 종목 시세 백필 | 매일 18:00 | `cron-daily-quotes.ts` | top 200 × 3 자산군 어제 봉 D1 upsert |
| 자산 마스터 갱신 | 일요일 17:00 | `cron-asset-master.ts` | 종목 신규 상장·이름 변경 반영 |
| 외부 API 한도 알림 | 매시간 | `cron-api-quota.ts` | 잔량 < 20% 시 운영자 알림 (Phase 2 — email/Slack) |

### 매주 (자동 cron, ADR-0021)

- 일요일 18:00 UTC (한국 월요일 03:00): `cron-r2-backup.ts`
  - D1 candles/indicators/assets/backfill_log 전체 dump
  - R2 `lab-trading-backup/YYYY-MM-DD/dump.sql.gz` 저장
  - 12주 retention 자동 prune

### 분기 (수동)

- [ ] 외부 데이터 제공자 ToS 재확인 (6개월 주기를 반기로 분리해도 무방)
- [ ] 지표 cross-check sampling — 인기 10종목 × 100봉 외부 도구 비교
- [ ] 휴장 캘린더 갱신 (NYSE/KRX 다음 연도 일정 — Phase 2.5 도입 시)
- [ ] Lighthouse 모니터링 (Performance 회귀)
- [ ] 번들 사이즈 트렌드 점검 (CI 자동 push되지만 분기 1회 시각 검토)

## 자주 하는 작업

### 1. 외부 API 키 갱신

**CoinGecko Demo 키 만료/회전:**
```bash
# 1. CoinGecko 대시보드에서 새 키 발급
# 2. wrangler secret put 으로 갱신
bunx wrangler secret put COINGECKO_API_KEY
# (prompt에 새 키 입력)
# 3. 30초 내 모든 PoP에 전파됨 (수동 재배포 불필요)
```

**KIS OAuth 토큰 (자동 갱신, 23h TTL):**
- 정상 동작 시 워커가 자동 갱신.
- 강제 갱신: KV의 `kis:oauth-token` 키 삭제 → 다음 요청 시 자동 재발급
  ```bash
  bunx wrangler kv:key delete --binding=LAB_KV "kis:oauth-token"
  ```

### 2. 캐시 invalidate

**특정 종목 캐시 강제 만료:**
```bash
# KV
bunx wrangler kv:key delete --binding=LAB_KV "adapter:coingecko:markets:..."

# Cache API는 PoP-local이라 일괄 무효화 불가
# → Workers Cache API의 TTL 만료를 기다리거나
# → 응답 Cache-Control 헤더에 `s-maxage=0` 임시 반환 후 다시 정상화
```

**전체 캐시 비우기 (긴급 시):**
```bash
# KV 전체 list + delete (스크립트)
bunx wrangler kv:bulk delete --binding=LAB_KV ...
# 또는 CF 대시보드 → KV → "Delete all keys"
```

### 3. D1 데이터 점검

**용량/row 카운트:**
```bash
bunx wrangler d1 execute lab-trading-db --command "SELECT COUNT(*) FROM candles"
bunx wrangler d1 execute lab-trading-db --command "SELECT COUNT(*) FROM indicators"
bunx wrangler d1 info lab-trading-db
```

**특정 종목 데이터 확인:**
```bash
bunx wrangler d1 execute lab-trading-db --command \
  "SELECT t, o, h, l, c, v FROM candles WHERE class='crypto' AND symbol='btc' ORDER BY t DESC LIMIT 5"
```

**지표 계산 버전 확인:**
```bash
bunx wrangler d1 execute lab-trading-db --command \
  "SELECT computed_version, COUNT(*) FROM indicators GROUP BY computed_version"
```

### 4. R2 백업 복원

**최신 백업 확인:**
```bash
bunx wrangler r2 object list lab-trading-backup --prefix="2026-"
```

**복원 (긴급 시 — D1 데이터 손실):**
```bash
# 1. 백업 다운로드
bunx wrangler r2 object get lab-trading-backup/2026-05-12/dump.sql.gz -o dump.sql.gz
gunzip dump.sql.gz

# 2. 새 D1 namespace 생성 (기존 보존 위해)
bunx wrangler d1 create lab-trading-db-restore

# 3. dump import
bunx wrangler d1 execute lab-trading-db-restore --file=dump.sql

# 4. wrangler.jsonc 의 database_id 갱신 후 재배포
# 5. 검증 후 기존 db 삭제 (rollback 가능 기간 1주)
```

### 5. 새 종목 추가

**lazy backfill만으로 충분 (사용자가 검색 시 자동 추가):**
- 종목 자체는 사용자 진입 시 D1 `assets` 테이블에 upsert
- 일봉 historical도 그 시점에 백필

**미리 push 하고 싶을 때:**
```bash
# 1. 자산 마스터에 추가
bunx wrangler d1 execute lab-trading-db --command \
  "INSERT INTO assets (class, symbol, name, name_ko, ticker, currency, updated_at) VALUES ('us', 'pltr', 'Palantir Technologies', '팔란티어', 'PLTR', 'USD', $(date +%s))"

# 2. 일봉 백필 트리거 (cron worker의 manual endpoint 호출 — Phase 2 admin UI 필요)
```

## 장애 대응

### A. 외부 API 다운 (CoinGecko/Twelve Data 등)

**감지:**
- Workers Logs에 4xx/5xx 빈도 ↑
- CF Analytics에 페이지 에러율 ↑

**1차 대응:**
- 어댑터의 stale-while-revalidate (ADR-0009)가 KV 마지막 성공값 자동 반환
- 사용자에게는 "갱신 N분 전" 라벨 그대로 (수치는 최근 캐시 값)
- 종목 상세 페이지 footer에 "일부 데이터 갱신이 지연되고 있습니다" 배너 (Phase 2 — 자동 감지 알림)

**2차 대응 (장시간 다운):**
- 어댑터 페일오버 활성화 — CoinGecko → CoinPaprika, Twelve Data → Stooq CSV (배치)
- Workers 환경변수 `DATA_FAILOVER=1` 설정 → 어댑터가 폴백 경로 사용

**3차 대응 (1일+ 다운):**
- 메인 페이지에 공지 카드 (수동 배포)
- 사용자에게 알림 (Phase 3 가입자에게만)

### B. CF Workers 한도 초과

**무료 plan 한도:**
- 100K requests/day
- D1: 5M reads/day, 100K writes/day
- KV: 100K writes/day, 10M reads/day
- R2: 1M class A ops/mo

**감지:**
- CF 대시보드 → Workers → Limits
- 429/quota exceeded 에러

**대응:**
1. 가장 흔한 원인: 봇 트래픽. `robots.txt` + CF Bot Fight Mode 활성화
2. D1 writes 압박: lazy backfill 빈도 ↓, cron 시점 조정
3. KV reads 압박: PoP cache TTL ↑
4. 진짜 사용자 트래픽이라면 유료 Plan 전환 ($5/mo Workers Paid)

### C. D1 용량 압박

**감지:** `wrangler d1 info`에서 SIZE > 4 GB (5 GB의 80%)

**대응:**
1. **오래된 데이터 prune** — 백테스트 5년 한도라면 10년 이전 일봉 삭제 (R2 백업에 보존 후):
   ```sql
   DELETE FROM candles WHERE t < strftime('%s', 'now', '-10 years');
   DELETE FROM indicators WHERE t < strftime('%s', 'now', '-10 years');
   ```
2. **지표 컬럼 prune** — 사용 안 하는 지표 컬럼 (e.g. ema_50 미사용) DROP COLUMN
3. **Turso 이주** — 9 GB 무료 한도 (ADR-0021 마이그레이션 가이드 참조)

### D. 데이터 정합성 의심 (사용자 신고)

**예: "BTC 가격이 너무 다르다"**

1. 어댑터 source 확인 — 같은 종목이 CoinGecko / Upbit / Binance에 서로 다른 가격 (정상, 거래소 간 spread)
2. 사용자가 보는 통화 확인 (KRW vs USD)
3. D1 데이터 점검:
   ```bash
   bunx wrangler d1 execute lab-trading-db --command \
     "SELECT t, c, source FROM candles WHERE class='crypto' AND symbol='btc' AND t > strftime('%s', 'now', '-7 days') ORDER BY t DESC"
   ```
4. 외부 도구(TradingView/CoinGecko 웹)와 cross-check
5. 어댑터 버그면 fix + 영향받은 row backfill

**예: "백테스트 결과가 이상하다"**

1. `computed_version` 확인 — 최신 버전이 적용됐는지
2. 같은 입력 + 같은 버전 = 같은 결과 (결정론) — 사용자 입력 재확인
3. SMA/RSI 계산값을 별도 도구(Python pandas-ta)와 비교
4. 휴장일/분할 처리 확인 (ADR-0025)

## 보안

### Workers Secrets 관리

- 모든 API 키는 `wrangler secret put` (절대 `vars`에 X)
- 로컬 dev는 `.dev.vars` (gitignore)
- 키 회전 주기: 6개월 (CoinGecko/Twelve Data), KIS는 12개월 또는 ToS 변경 시
- 키 회전 시 무중단 — `wrangler secret put`는 30초 내 모든 PoP 전파

### CF 보안 설정

- WAF (Web Application Firewall): CF 무료 plan 기본 활성
- Bot Fight Mode: 활성화 (특히 API route)
- Rate Limiting: `/api/*` 라우트에 100 req/min per IP (Phase 2 도입)
- CSP 헤더: Workers response에 명시 (`Content-Security-Policy` 빌드 시 lighthouse 적합화)

### 분석/모니터링 (ADR-0023)

- CF Web Analytics — 쿠키/개인식별자 X (PIPA 안전)
- Workers Logs — 사용자 IP 로그 회피 (필요 시만 hash)
- 에러 메시지에 사용자 입력 raw 포함 금지 (예: 검색 쿼리는 hash 또는 truncate)

## 비상 연락처 (운영자 추가)

- CF 지원: <https://dash.cloudflare.com/?to=/:account/support>
- KIS 개발자: <https://apiportal.koreainvestment.com/community/qna>
- 외부 도구 장애 페이지: 직접 등록 (예: <https://status.coingecko.com/>, <https://status.twelvedata.com/>)
- 도메인 DNS 관리자: (운영자)
- 도메인 등록 만료: (운영자, krutils.com 갱신일)

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-13 | 초안 — 1차 출시 전 체크리스트 + 자주 하는 작업 + 장애 대응 + 보안 | 운영 점검 절차 표준화 |
