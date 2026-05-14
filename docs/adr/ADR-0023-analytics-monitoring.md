# ADR-0023: 분석 · 모니터링 도구

- 상태: Accepted
- 날짜: 2026-05-13
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 약함)
- 관련 ADR: ADR-0017 (개인정보), ADR-0009 (캐시 모니터링)

## 컨텍스트

운영 시 봐야 할 것:

1. **사용 패턴** — 어떤 자산군·페이지가 인기인가? 검색 키워드는?
2. **성능** — Core Web Vitals (LCP, INP, CLS), 페이지 로드 시간
3. **에러** — JS exception, 외부 API 4xx/5xx, 캐시 miss rate
4. **외부 API 한도** — CoinGecko/Twelve Data/KIS 남은 요청 추적
5. **CF Workers 비용/한도** — request count, CPU time, D1 reads/writes

## 검토한 옵션

### 분석 (사용자 트래픽)

| 후보 | 무료 | 개인정보 | Workers 통합 |
|---|---|---|---|
| **Cloudflare Web Analytics** | 무료 무제한 | privacy-first (쿠키/IP 추적 X) | 네이티브 |
| Cloudflare Workers Analytics Engine | 무료 1000만 dp/day | 사용자 정의 metrics | 네이티브 |
| Plausible | $9/mo+ (cloud) / self-host | privacy-first | HTTP script |
| Vercel Analytics | 유료 | 쿠키 사용 | Vercel 전용 |
| Google Analytics 4 | 무료 | 쿠키 + ID 추적 (GDPR/PIPA 부담) | script |
| Umami self-hosted | 무료 (자체 호스팅) | privacy-first | self-host |

### 에러 모니터링

| 후보 | 무료 | Workers 통합 |
|---|---|---|
| **Cloudflare Workers Logs** (Logpush) | 무료 (R2 또는 외부) | 네이티브 |
| **Cloudflare Workers Tail Worker** | 무료 | 네이티브 |
| Sentry | 5K events/mo | SDK (Workers 호환 확인) |
| Rollbar / Bugsnag | 무료 한도 좁음 | SDK |
| Better Stack (Logtail) | 무료 1GB/mo | HTTP |

### Web Vitals

- **Cloudflare Web Analytics**가 Core Web Vitals 자동 측정·노출.
- 사용자 정의 측정은 `web-vitals` 라이브러리(3 KB) + Cloudflare Workers Analytics Engine에 push.

## 결정

**1차 출시 — Cloudflare 무료 스택만:**

| 영역 | 도구 | 비용 |
|---|---|---|
| 사용자 트래픽 분석 | Cloudflare Web Analytics | 무료 |
| Web Vitals | Cloudflare Web Analytics (자동) | 무료 |
| 에러/로그 | Cloudflare Workers Logs + Tail Worker (dev) | 무료 |
| 사용자 정의 metrics | Cloudflare Workers Analytics Engine | 무료 |
| 외부 API 한도 추적 | Workers Analytics Engine + 응답 헤더 파싱 | 무료 |
| D1/KV 사용량 | CF 대시보드 | 무료 |

근거:
1. Cloudflare 스택 안에서 무료로 충분 — 별도 SDK·외부 호스트 부담 0.
2. 개인정보 처리 0 (CF Web Analytics는 쿠키·IP 추적 안 함 → 한국 PIPA 부담 없음).
3. ADR-0016(localStorage 단독) 정책과 정합.

**Phase 2+ 고려:**
- Sentry — JS exception 추적 깊이 (Workers SDK 호환 확인 후)
- Plausible — 자체 대시보드가 더 마음에 들면 추가 ($9/mo)
- Better Stack — 로그 쿼리·알람 강화

**Cloudflare Web Analytics 활성화:**
- CF 대시보드 → Web Analytics → 사이트 등록 → site token 발급
- `app/[locale]/layout.tsx`의 `<head>`에 beacon script 1줄
- 또는 CF Pages/Workers는 자동 활성 (zone-level)

**Workers Analytics Engine 사용:**
```ts
// 외부 API 한도 추적 예시
env.ANALYTICS.writeDataPoint({
  blobs: ['coingecko', 'markets'],
  doubles: [parseInt(response.headers.get('x-ratelimit-remaining') ?? '0')],
  indexes: ['coingecko-quota'],
});
```

대시보드: CF 대시보드의 Analytics Engine SQL 쿼리.

**개인정보 처리방침** (ADR-0017):
- "본 사이트는 Cloudflare Web Analytics를 사용합니다. 쿠키·개인식별자를 사용하지 않으며, 집계된 트래픽 통계만 수집됩니다."

## 결과

### 긍정적
- 1차 출시 운영 비용 0.
- 한국 PIPA / GDPR 부담 없음 (개인정보 처리 X).
- Cloudflare 스택 안에서 통합 모니터링.

### 부정적
- 사용자 행동 깊은 추적 (퍼널·세션) X. → 완화: 1차 출시 목표는 트래픽 양 + Web Vitals + 에러율 모니터링. 깊은 행동 분석은 Phase 2+에 별도 도입.
- Sentry 수준의 stack trace symbolication 부재. → 완화: Workers Logs로 raw 로그 확보, Phase 2+에 Sentry SDK 검토.

### 따라오는 작업
- CF 대시보드 → Web Analytics 사이트 등록 (배포 시점)
- `app/[locale]/layout.tsx`에 beacon script
- `lib/analytics.ts` — Workers Analytics Engine 래퍼
- 어댑터에서 외부 API 응답 헤더 파싱 + Analytics Engine push
- 개인정보 처리방침 페이지(`/legal/privacy`)에 분석 도구 명시 — ADR-0017 작업
- Phase 2: Sentry / Plausible 도입 여부 결정 ADR

## 참고

- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/)
- [Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Workers Logs / Logpush](https://developers.cloudflare.com/workers/observability/logs/)
- [web-vitals npm](https://github.com/GoogleChrome/web-vitals)
