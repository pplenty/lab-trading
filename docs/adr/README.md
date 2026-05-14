# Architecture Decision Records (ADR)

lab-trading의 굵직한 기술/제품 결정을 기록한다. 결정 자체보다 **결정의 컨텍스트·트레이드오프**를 잃지 않는 것이 목적.

## 1차 출시 결정 일괄 확정

2026-05-14, 사용자가 [`/DECISIONS.md`](../../DECISIONS.md) Q1-Q16 권장안에 일괄 동의하여 **ADR-0001~0025 모두 `Accepted`** 로 전환됐다. 각 ADR 헤더에 `결정 확정: 2026-05-14` 라인이 추가됐다.

새로 발생하는 결정 — 출시 후 정책 변경·신규 자산군·차트 라이브러리 교체 등 — 은 새 ADR(0026+)로 박는다. 이전 ADR을 뒤집을 때는 `Superseded by ADR-XXXX`로 상태 갱신.

## 작성 시점

"되돌리기 어려운" 결정에 대해 ADR을 작성한다:

- 프레임워크·라이브러리·호스팅 선택
- URL·라우팅 구조
- 데이터 어댑터·캐시 전략·보안 정책
- 디자인 토큰 / 컬러 시맨틱 변경
- 컨벤션 변경 (CLAUDE.md의 컨벤션 섹션)

다음은 ADR을 만들지 않는다:

- 단일 페이지 추가, 버그 수정, 카피 수정
- 단일 PR로 되돌릴 수 있는 결정

## 작성 방법

1. `adr-new` 슬래시 스킬 호출 (도입 후) → 다음 번호 자동 부여.
2. 수동 작성: `template.md` 복사 → `ADR-NNNN-<kebab-slug>.md`.
3. PR로 리뷰. 머지 전 `Proposed`, 머지 후 `Accepted`.

## 상태 흐름

```
Proposed → Accepted → (시간 경과 후) → Deprecated
                  └→ Superseded by ADR-XXXX
```

이전 결정을 뒤집을 때는 새 ADR을 만들고, 이전 ADR 상태를 `Superseded by ADR-XXXX`로 변경한다. 이전 ADR 삭제 금지.

## 인덱스

| # | 제목 | 상태 | 사용자 결정 |
|---|------|------|------------|
| [0000](ADR-0000-adr-system.md) | ADR 시스템 도입 | Accepted | — |
| [0001](ADR-0001-mission-and-scope.md) | 제품 미션 · 1차 출시 스코프 | Accepted | **필요** |
| [0002](ADR-0002-tech-stack.md) | 기술 스택 (Next.js 16 + React 19 + Tailwind v4 + bun) | Accepted | 확인 |
| [0003](ADR-0003-hosting.md) | 호스팅 · 어댑터 (Cloudflare Workers + `@opennextjs/cloudflare`) | Accepted | 약함 |
| [0004](ADR-0004-i18n.md) | i18n 전략 (ko 단독 → en 후속) | Accepted | **필요** |
| [0005](ADR-0005-data-sources-crypto.md) | 코인 데이터 소스 | Accepted | **필요** |
| [0006](ADR-0006-data-sources-foreign-stocks.md) | 해외 주식 데이터 소스 | Accepted | **필요** |
| [0007](ADR-0007-data-sources-kr-stocks.md) | 국내 주식 데이터 소스 | Accepted | **필요** |
| [0008](ADR-0008-news-rss.md) | 뉴스 / RSS 큐레이션 | Accepted | **필요** |
| [0009](ADR-0009-caching-and-storage.md) | 캐싱 & 스토리지 (CF Cache + KV) | Accepted | 약함 |
| [0010](ADR-0010-data-model-and-symbols.md) | 데이터 모델 · Symbol 정규화 | Accepted | — (설계) |
| [0011](ADR-0011-chart-library.md) | 차트 라이브러리 | Accepted | **필요** |
| [0012](ADR-0012-color-semantics.md) | 상승/하락 컬러 시맨틱 (한국식 vs 글로벌식) | Accepted | **필요** |
| [0013](ADR-0013-realtime-vs-polling.md) | 실시간 데이터 전략 (폴링 vs WS vs SSE) | Accepted | 약함 |
| [0014](ADR-0014-categories-and-menu.md) | 카테고리 · 메뉴 구조 | Accepted | **필요** |
| [0015](ADR-0015-launch-pages.md) | 1차 출시 페이지 셋 | Accepted | **필요** |
| [0016](ADR-0016-user-accounts.md) | 사용자 계정 · 개인화 (익명 vs 가입) | Accepted | **필요** |
| [0017](ADR-0017-legal-disclaimer.md) | 법률 · 컴플라이언스 · 면책 | Accepted | 약함 |
| [0018](ADR-0018-domain.md) | 도메인 · 브랜딩 | Accepted | **필요** |
| [0019](ADR-0019-backtest-engine.md) | 백테스트 엔진 (클라이언트 vs 서버) | Accepted | **필요** |
| [0020](ADR-0020-backtest-strategy-dsl.md) | 백테스트 전략 표현 방식 | Accepted | **필요** |
| [0021](ADR-0021-historical-storage.md) | Historical 데이터 + 지표 저장소 (D1 + Drizzle + R2 백업) | Accepted | **필요** |
| [0022](ADR-0022-unified-search.md) | 자산군 통합 검색 (Cmd+K, 정적 인덱스 + D1 fallback) | Accepted | 약함 |
| [0023](ADR-0023-analytics-monitoring.md) | 분석 · 모니터링 (CF Web Analytics + Workers Logs) | Accepted | 약함 |
| [0024](ADR-0024-currency-and-fx.md) | 통화 표시 · 환율 (Frankfurter, native+보조 표시) | Accepted | 약함 |
| [0025](ADR-0025-holidays-corporate-actions.md) | 휴장 · 분할 · 배당 처리 (1차: split-adjusted, 배당 미반영) | Accepted | 약함 |
