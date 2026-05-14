# ADR-0003: 호스팅 · 어댑터

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자가 "CF로 배포할거야" 명시)
- 관련 ADR: ADR-0002 (스택), ADR-0009 (캐시·KV), ADR-0013 (실시간)

## 컨텍스트

사용자가 "CF를 통해 배포할거야"라고 명시. CF에는 여러 호스팅 surface가 있다 — Pages, Workers, Workers + Static Assets, 그리고 `@opennextjs/cloudflare` 어댑터 두 모델 (Pages Functions vs Workers + Assets). yutils가 검증한 패턴을 그대로 차용할지, 다른 surface로 갈지 잠근다.

## 검토한 옵션

### A. Cloudflare Workers + `@opennextjs/cloudflare` 어댑터 (yutils와 동일)
- 장점: yutils ADR-0010·0024에서 검증됨. `wrangler.jsonc`만 갱신하면 배포 동작. Workers의 Cache API + KV + D1 + R2를 모두 사용 가능 (lab-trading의 데이터 캐시 전략과 직결). compatibility flag `nodejs_compat`로 일부 Node 모듈 동작.
- 단점: Workers는 Edge Runtime이라 일부 Node-only 라이브러리(`net`/`tls`/`fs`/`worker_threads`) 사용 불가. 차트 라이브러리는 `dynamic({ssr:false})`로 우회 필요.

### B. Cloudflare Pages + Pages Functions
- 장점: 정적 자산 호스팅이 자연스러움. SSG 페이지가 Functions 워밍 오버헤드 없이 즉시 서빙.
- 단점: Pages는 Cloudflare가 점진적으로 Workers + Static Assets 모델로 통합 중. 신규 프로젝트는 Workers 모델 권장.

### C. Vercel (CF 대신)
- 장점: Next.js 1급 지원. Edge Functions, Image Optimization, ISR 모두 즉시.
- 단점: **사용자 요구사항 위배** (CF 명시).

### D. Self-hosted (Fly.io / Render / EC2)
- 장점: 가장 자유로움. Node 전체 사용 가능.
- 단점: 인프라 운영 비용. 사용자 요구사항 위배.

## 결정

**옵션 A 채택.**

근거:
1. yutils와 동일 어댑터 — 배포 워크플로우 학습 비용 0.
2. Workers Cache API + KV는 lab-trading의 데이터 캐시 전략(ADR-0009)에 1급 시민.
3. CF가 Pages를 Workers로 흡수하는 방향이라 신규 프로젝트는 Workers 모델이 미래지향적.
4. compatibility_date는 yutils와 동일하게 `2025-12-01`로 출발. `nodejs_compat` 플래그 활성화. **Workers 실행 환경의 의미 있는 변경**(R2 도입, D1 도입 등)이 있을 때만 ADR로 정정.

**잠금 항목:**
- `wrangler.jsonc`:
  - `name: "lab-trading"`
  - `compatibility_date: "2025-12-01"`
  - `compatibility_flags: ["nodejs_compat"]`
  - `main: ".open-next/worker.js"`
  - `assets.directory: ".open-next/assets"`
  - `assets.binding: "ASSETS"`
  - `vars`: 비워둠 (시크릿은 `wrangler secret put`)
- `open-next.config.ts`: default (`defineCloudflareConfig({})`)
- `middleware.ts` + `runtime: "experimental-edge"` (yutils ADR-0024 패턴)

## 결과

### 긍정적
- yutils 배포 스크립트(`cf:build`/`cf:preview`/`cf:deploy`) 그대로.
- Cache API + KV + D1 + R2 모두 옵션으로 열려 있음.
- Workers의 글로벌 PoP 덕분에 한국 사용자 latency 양호.

### 부정적
- Workers Edge Runtime의 제약 — 일부 npm 패키지 호환 안 됨. → 완화: 외부 라이브러리 도입 시 PR 본문에 "Workers 호환성 확인" 필수.
- Cold start는 Vercel보다 살짝 길 수 있음. → 완화: SSG/ISR로 빌드 타임에 정적 생성하고 RSC + cache API로 동적 부분만 처리.
- middleware deprecation warning 가능성 (Next 16). → 완화: yutils ADR-0024가 검증한 `experimental-edge` 패턴 차용.

### 따라오는 작업
- 첫 배포 전: 사용자 `bunx wrangler login`
- production 도메인 결정 후 `wrangler.jsonc` vars 또는 CF 대시보드 vars에 `NEXT_PUBLIC_SITE_URL` 설정
- API 키는 `wrangler secret put` 사용 (CoinGecko Demo, Twelve Data, Finnhub 등 — ADR-0005~0007에 따라)
- 로컬 시크릿은 `.dev.vars` (gitignore)

## 참고

- yutils ADR-0004 (호스팅), ADR-0010 (어댑터), ADR-0024 (middleware + edge)
- [@opennextjs/cloudflare docs](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
