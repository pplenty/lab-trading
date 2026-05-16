# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

**lab-trading** — 코인 · 해외주식 · 국내주식 통합 정보 사이트 + **일봉 백테스트 랩**.

세 자산군의 시세·랭킹·뉴스를 한 곳에서 비교하고, 같은 화면에서 **사용자 전략을 일봉 기준으로 백테스트**하여 수익률·MDD·Sharpe 결과를 즉시 확인할 수 있는 웹 서비스. Cloudflare Workers + Next.js (App Router) 기반.

### 1차 비전 (한 문장)

> "한국식·미장·코인 어디든 같은 UI로 시세를 보고, 같은 UI로 백테스트를 돌릴 수 있는 사이트."

### 레퍼런스

- **자매 프로젝트 [yutils](../yutils)** — UI 톤·AppShell·라우팅 패턴·ADR 시스템·하네스 구조를 그대로 차용한다. 카드형 그리드 + 좌측 sticky 사이드바 + 다크/라이트 axis + 사용자 라이트 프리셋 12종 시스템을 재사용. yutils 자체의 라이브 사이트: <https://devtools.krutils.com/ko>
- **TradingView** — 차트 인터랙션·심볼 검색 UX의 1차 레퍼런스.
- **Investing.com / Naver 금융 / 토스증권** — 한국어 사용자가 익숙한 정보 밀도·랭킹 노출 방식.
- **Bogleheads / Portfolio Visualizer** — 백테스트 UX의 보수적 레퍼런스.

### 핵심 원칙

1. **자산군 통일 모델** — 코인·해외주식·국내주식 모두 동일한 `Asset` / `OHLCV` 추상으로 다룬다. 자산군별로 UI를 따로 만들지 않고, 카테고리는 **메뉴 그룹**일 뿐 페이지 컴포넌트는 재사용한다.
2. **읽기 전용 + 익명 우선** — 매매 기능, 호가창 직접 연동, 주문 API 없음. 시세·랭킹·뉴스·백테스트만 제공. 사용자 데이터는 기본 `localStorage`(즐겨찾기·테마·전략 프리셋).
3. **일봉 기준 백테스트가 1급 시민** — 시세 화면과 같은 정보 평면에서 "이 종목/전략을 일봉으로 백테스트" 진입이 1-2 클릭. 일봉 이상의 시간 단위(주봉·월봉)도 허용. 분봉/초봉 백테스트는 **명시적 스코프 제외**.
4. **데이터는 캐시하지 않으면 죽는다** — 무료 API 한도(분당 ~30회 수준)와 CF Workers의 응답시간 예산을 동시에 만족하려면 **Edge cache + CF KV** 2층 캐싱 + 자산군별 TTL이 필수. ADR-0009 참조.
5. **검색 진입 최우선** — yutils와 동일하게 "비트코인 시세", "삼성전자 차트", "AAPL 백테스트" 같은 구글 검색 진입을 가정한다. 모든 자산 페이지는 고유 URL · canonical · OG · JSON-LD를 가진다.
6. **금융 정보 표시의 책임** — 모든 페이지 하단에 면책 고지(투자 권유 아님, 데이터 지연 가능, 출처 표기). 데이터 출처는 항상 노출. ADR-0017 참조.

### 명시적 스코프 제외

- 실제 주문·매매 실행
- 분봉/초봉 데이터, 호가창 라이브 피드, 체결 단위 데이터
- 알고리즘 트레이딩 봇·자동매매
- 파생상품 가격 모델링 (옵션 그릭스·선물 만기 등)
- 한국 법상 "투자자문업"에 해당하는 추천·자문 콘텐츠

## 현재 상태 (2026-05-16, Phase 2)

- **Production 라이브 (`trading.jdgrid.com`).** 3 자산군 × 시세·랭킹·종목상세·백테스트 + 대시보드 / 통합 검색 / 즐겨찾기·최근 / 저장된 전략 / URL 공유 / 종목 미니뷰 + **6 매체 RSS 뉴스 (D1 archive + KV hot cache)** + **종목 ↔ 관련 뉴스 매칭**.
- 자산군별 상태 (모두 라이브, **80 종목**):
  - **crypto**: Upbit Public API + CoinGecko 보조 — **26 종목** (BTC ETH SOL XRP DOGE ADA TRX AVAX LINK MATIC DOT BCH ETC ATOM NEAR APT ARB OP SAND FIL ALGO AAVE UNI VET HBAR MANA · LTC 는 Upbit KRW 페어 X 라 검색 인덱스만 등록).
  - **us**: Twelve Data — **30 종목** (AAPL MSFT NVDA GOOGL AMZN META TSLA JPM V LLY XOM BRK.B + WMT UNH ORCL HD MA PG COST AVGO ABBV CVX KO PFE BAC NFLX ADBE CRM MRK PEP).
  - **kr**: KIS Open API — **24 종목** (KOSPI 20 + KOSDAQ 4).
- **D1 (`lab-trading-db`) — 80종목 × 107,668 candles + 106,809 indicators (2021-05-17 ~ 2026-05-16)**. 페이지·백테스트가 `loadCandleSeries` / `loadQuote` / `loadQuotesList` 헬퍼로 D1 우선 + 어댑터 fallback. 어댑터 부분 실패 시 누락 종목만 D1 합성 (`d1-fallback` source 라벨 + `D1FallbackBadge` UI 노출).
- **뉴스 (`news_articles` 테이블)**: 한국경제 금융/경제 + 매일경제 + 파이낸셜뉴스 증권/금융 + 토큰포스트 6 endpoint. 30분 cron 으로 fetch + D1 UPSERT + KV `news:{class}` hot cache. 종목 상세 페이지에 keyword 기반 관련 뉴스 5개 노출.
- 활성 라우트: 대시보드(/), 3 자산군 × {/, /gainers, /losers, /volume, /[symbol], **/news**}, /backtest/new, /backtest/saved, /search, /settings + 404 catch-all + `/api/{health,backfill,cron/backfill,cron/news-pull}`. stub: /kr/kospi, /kr/kosdaq.
- 사용자 자산 (localStorage, ADR-0016): 즐겨찾기 ⭐ + 최근 본 ⏰ + 저장된 전략 + 결과 URL 공유 (`/backtest/new?asset=...&symbol=...&strategy=...&<param>=...` prefill).
- **운영**:
  - **Workers 배포** — `lab-trading.jason-parsing.workers.dev` + Custom Domain `trading.jdgrid.com`. Secrets ~10개.
  - **D1/KV/R2 namespace** — 모두 박힘. KV 가 KIS OAuth 토큰 캐시 (cold start `EGW00133` 1분 한도 회피) + 뉴스 hot cache.
  - **Cron 2개** — GitHub Actions:
    - `cron-backfill.yml` 매일 06:00 UTC: `/api/cron/backfill` 증분 봉
    - `cron-news.yml` 30분마다: `/api/cron/news-pull` RSS 수집
  - **`/api/health` D1 freshness** — candles/indicators/symbols/latestTs/staleDays 노출. uptime probe 가 단순 binding 확인 외 데이터 신선도 검증.
  - **`callTwelve` helper 통합** — Twelve Data 모든 endpoint 가 단일 helper 경유 (status:"error" guard / 분당 8 req 한도 처리). 신 endpoint 추가 시 회귀 안전.
- 코드: **120+ 파일, ~12,000 줄, Vitest 98 ✓, sitemap 198 URLs (80종목 × 2 locale + 뉴스/static)**.
- 다음 진입: Google Search Console 등록 + sitemap 제출 / 백테스트가 D1 사전계산 indicators 활용 (SMA200/RSI 등) / OG 동적 이미지 / Performance Lighthouse 측정.

## 결정 추적 (ADR)

굵직한 결정은 `docs/adr/`에 ADR로 박는다. 인덱스: [docs/adr/README.md](docs/adr/README.md).

**현재 상태 — 모두 `Accepted` (2026-05-14)**: 사용자가 `DECISIONS.md` Q1-Q16 권장안에 일괄 동의하여 ADR-0001~0025 모두 채택. 각 ADR 헤더에 `결정 확정: 2026-05-14` 라인 추가. 새로 발생하는 결정은 ADR-0026+ 로 박는다.

| # | 제목 | 사용자 결정 필요? |
|---|------|-------------------|
| [0000](docs/adr/ADR-0000-adr-system.md) | ADR 시스템 도입 | — (메타) |
| [0001](docs/adr/ADR-0001-mission-and-scope.md) | 제품 미션 · 1차 출시 스코프 | **Yes** |
| [0002](docs/adr/ADR-0002-tech-stack.md) | 기술 스택 (Next 16 + React 19 + Tailwind v4 + bun) | **Yes** (yutils 차용 확인) |
| [0003](docs/adr/ADR-0003-hosting.md) | Cloudflare Workers + `@opennextjs/cloudflare` | 약함 (사실상 확정) |
| [0004](docs/adr/ADR-0004-i18n.md) | i18n 전략 (ko 단독 vs ko+en) | **Yes** |
| [0005](docs/adr/ADR-0005-data-sources-crypto.md) | 코인 데이터 소스 | **Yes** |
| [0006](docs/adr/ADR-0006-data-sources-foreign-stocks.md) | 해외 주식 데이터 소스 | **Yes** |
| [0007](docs/adr/ADR-0007-data-sources-kr-stocks.md) | 국내 주식 데이터 소스 | **Yes** (법적 위험 부분 포함) |
| [0008](docs/adr/ADR-0008-news-rss.md) | 뉴스 / RSS 큐레이션 | **Yes** |
| [0009](docs/adr/ADR-0009-caching-and-storage.md) | 캐싱 & 스토리지 (CF KV / D1 / R2) | 약함 |
| [0010](docs/adr/ADR-0010-data-model-and-symbols.md) | 데이터 모델 · Symbol 정규화 | — (설계) |
| [0011](docs/adr/ADR-0011-chart-library.md) | 차트 라이브러리 | **Yes** |
| [0012](docs/adr/ADR-0012-color-semantics.md) | 상승/하락 컬러 시맨틱 (한국식 vs 글로벌식) | **Yes** |
| [0013](docs/adr/ADR-0013-realtime-vs-polling.md) | 실시간 전략 (폴링 vs WS vs SSE) | 약함 |
| [0014](docs/adr/ADR-0014-categories-and-menu.md) | 카테고리 · 메뉴 구조 | **Yes** |
| [0015](docs/adr/ADR-0015-launch-pages.md) | 1차 출시 페이지 셋 | **Yes** |
| [0016](docs/adr/ADR-0016-user-accounts.md) | 사용자 계정 · 개인화 (익명 vs 가입) | **Yes** |
| [0017](docs/adr/ADR-0017-legal-disclaimer.md) | 법률 · 컴플라이언스 · 면책 | 약함 (필수, 문구만) |
| [0018](docs/adr/ADR-0018-domain.md) | 도메인 · 브랜딩 | **Yes** |
| [0019](docs/adr/ADR-0019-backtest-engine.md) | 백테스트 엔진 (클라이언트 vs 서버) | **Yes** |
| [0020](docs/adr/ADR-0020-backtest-strategy-dsl.md) | 백테스트 전략 표현 방식 | **Yes** |
| [0021](docs/adr/ADR-0021-historical-storage.md) | Historical 데이터 + 지표 저장소 (D1 + Drizzle + R2 백업) | **Yes** |
| [0022](docs/adr/ADR-0022-unified-search.md) | 자산군 통합 검색 (Cmd+K, 정적 인덱스 + D1 fallback) | 약함 |
| [0023](docs/adr/ADR-0023-analytics-monitoring.md) | 분석 · 모니터링 (CF Web Analytics + Workers Logs) | 약함 |
| [0024](docs/adr/ADR-0024-currency-and-fx.md) | 통화 표시 · 환율 (Frankfurter, native+보조 표시) | 약함 |
| [0025](docs/adr/ADR-0025-holidays-corporate-actions.md) | 휴장 · 분할 · 배당 처리 (1차: split-adjusted, 배당 미반영) | 약함 |

검토 편의를 위해 **사용자가 답해야 할 핵심 질문만 모아 [DECISIONS.md](DECISIONS.md)** 에 별도 정리. 모바일에서 30분 안에 훑을 수 있도록 1줄 질문 + 권장안 + 이유 형식.

새 결정은 `adr-new` 스킬 호출 → 다음 번호 자동 부여. 작성 기준은 `docs/adr/README.md`.

## 카테고리 / 메뉴 구조 (제안)

ADR-0014에서 사용자 결정. 1차 제안:

```
대시보드                  /             — 3 자산군 통합 위젯 (top movers, 주요 지수, 최근 뉴스)

코인                      /crypto
  ├ 시세                  /crypto                     — 시가총액 정렬 ticker
  ├ 상승률                /crypto/gainers
  ├ 하락률                /crypto/losers
  ├ 거래량                /crypto/volume
  ├ 뉴스                  /crypto/news
  └ 개별 종목 상세        /crypto/[symbol]            — 차트 + 통계 + 백테스트 진입

해외주식                  /us              (영문 라벨은 Global; 1차 미장 중심)
  ├ 시세                  /us
  ├ 상승률                /us/gainers
  ├ 하락률                /us/losers
  ├ 거래량                /us/volume
  ├ 뉴스                  /us/news
  └ 개별 종목 상세        /us/[symbol]

국내주식                  /kr
  ├ 코스피                /kr/kospi
  ├ 코스닥                /kr/kosdaq
  ├ 상승률                /kr/gainers
  ├ 하락률                /kr/losers
  ├ 거래량                /kr/volume
  ├ 뉴스                  /kr/news
  └ 개별 종목 상세        /kr/[ticker]                — 005930 형식

백테스트 랩              /backtest
  ├ 새 전략               /backtest/new
  ├ 내 전략               /backtest/saved            — localStorage 기반
  └ 결과 공유             /backtest/share/[id]       — Phase 2 옵션

검색                      /search?q=...                — 자산군 통합 검색
설정                      /settings                    — 테마 · 컬러 시맨틱 · 언어 · 데이터 출처
```

URL 구조의 트레이드오프는 ADR-0014.

## 컨벤션

yutils의 컨벤션 A~L을 차용하되, 트레이딩 도메인 특화 항목(M ~ Q)을 추가한다.

### A. 자산 모듈 단위
- 자산군별 페이지 컴포넌트는 `app/[locale]/(asset)/...`로 라우팅, 비즈니스 로직은 `lib/assets/<class>/`에 모은다.
- 자산군: `crypto`, `us`, `kr` (소문자 슬러그 고정).
- 자산군별 데이터 어댑터: `lib/adapters/<provider>.ts` — provider 단위로 분리 (예: `coingecko.ts`, `yahoo.ts`, `krx.ts`).
- 어댑터 인터페이스 통일:
  ```ts
  type AssetClass = "crypto" | "us" | "kr";
  type Quote = {symbol: string; price: number; changePct: number; volume: number; updatedAt: string};
  type Candle = {t: number /* unix sec, UTC */; o: number; h: number; l: number; c: number; v: number};
  interface DataAdapter {
    class: AssetClass;
    listQuotes(opts?: ListOpts): Promise<Quote[]>;
    getQuote(symbol: string): Promise<Quote>;
    getCandles(symbol: string, opts: CandleOpts): Promise<Candle[]>;
    rankings(kind: "gainers" | "losers" | "volume"): Promise<Quote[]>;
  }
  ```
  자세한 타입은 ADR-0010.

### B. 카테고리 / URL 슬러그
ADR-0014에서 잠금. 슬러그는 자산군 약어를 사용한다:
- `crypto` — 코인 (KRW·USDT 페어 통합)
- `us` — 해외주식 (미장 중심, 유럽·일본은 Phase 2)
- `kr` — 국내주식 (KOSPI + KOSDAQ)
- `backtest` — 백테스트 랩

URL은 사실상 불변 자원. 슬러그 변경 시 반드시 301.

### C. URL / 라우팅
- 자산군 인덱스: `/<asset-class>` — 예: `/crypto`, `/us`, `/kr`.
- 랭킹: `/<asset-class>/<ranking>` — `gainers` / `losers` / `volume`.
- 종목 상세: `/<asset-class>/[symbol]` — symbol은 normalize된 슬러그 (ADR-0010).
- 백테스트: `/backtest/new?asset=<class>&symbol=<symbol>&strategy=<preset>`.
- 검색: `/search?q=...`.
- canonical: 모두 소문자, trailing slash 없음, 쿼리는 검색·필터·백테스트 파라미터에만.

### D. SEO 메타 (자산 페이지 필수)
- `<title>`: `{종목명} ({심볼}) 시세 · 차트 · 백테스트 — lab-trading`.
- `<meta description>`: 1~2문장, 가격·24h 변동률·시가총액 포함.
- `og:image`: 종목 상세는 동적 OG (Phase 2, 1차는 로고+심볼+가격 정적 카드).
- JSON-LD: `FinancialProduct` (코인은 `Product`로 폴백) + `BreadcrumbList`.
- 첫 화면(above-the-fold)에는 가격·변동률·차트가 즉시 보여야 한다. 인트로 카피 X.

### E. 데이터 처리 — 서버 캐시 우선
- yutils가 "클라이언트 우선"이라면 lab-trading은 **"서버(Edge) 캐시 우선"**.
- 모든 외부 API 호출은 Cloudflare Workers에서 수행한다. 클라이언트는 우리 RSC/Route handler만 호출.
- 자산군별 캐시 TTL은 ADR-0009. 기본값:
  - ticker 리스트: 30s
  - 종목 시세: 15s
  - 일봉 historical: 1h (오늘 봉 제외)
  - 일봉 historical 오늘: 60s
  - 뉴스 RSS: 5min
- 캐시는 (1) Cloudflare cache API, (2) Workers KV, (3) 메모리 LRU 3층. 우선 (1)+(3)부터, KV는 backfill·랭킹 전용.

### F. 테마 토큰
- yutils 패턴(ADR-0008·0009) 그대로 차용. `lib/themes.ts`에 라이트 프리셋 + system/light/dark axis.
- **추가**: 상승/하락 컬러 토큰 — `--color-up`, `--color-down`. 한국식(빨강=상승, 파랑=하락) vs 글로벌식(초록=상승, 빨강=하락) 전환을 `localStorage` (`lab-trading-color-semantics`)로 유지. 기본값은 ADR-0012에서 결정.
- 변동률 색은 항상 `--color-up`/`--color-down` 경유. hex 직접 박지 않는다.

### G. 언어 / 카피
- yutils와 동일: 한 화면에 한 언어. 단, 데이터에 포함된 종목 정식명(예: `Apple Inc.`, `삼성전자`)은 출처 데이터를 그대로 노출 — 번역하지 않는다.
- 1차 출시 기본 언어: 한국어. 영어 i18n은 데이터 자체가 글로벌이라 의미가 크지만, ko 잠금 후 추가 (ADR-0004).

### H. 파일 / 폴더
- 폴더명: kebab-case.
- 자산 페이지: `app/[locale]/<class>/page.tsx`, `app/[locale]/<class>/[symbol]/page.tsx`.
- 비즈니스 로직: `lib/<domain>/<file>.ts` — 예: `lib/symbols/normalize.ts`, `lib/backtest/run.ts`.
- 데이터 어댑터: `lib/adapters/<provider>.ts`.
- 차트 컴포넌트: `components/charts/<Type>.tsx` — `Candle.tsx`, `Line.tsx`, `Sparkline.tsx`, `VolumeBars.tsx`.

### I. 접근성 (WCAG AA 최소선)
- yutils 컨벤션 그대로.
- 추가: 변동률 컬러로만 의미를 전달하지 않는다. 화살표 (▲/▼) 또는 `+`/`-` 부호를 항상 병기. 색맹 사용자 대응.
- 차트 캔버스는 `aria-label` + 우측에 라이브 텍스트 요약(`<dl>`) 동반.

### J. 성능
- 자산 페이지 초기 JS 페이로드 **250KB(gzipped) 이하** 목표. 차트 라이브러리 무게 때문에 yutils(200KB)보다 50KB 여유.
- 차트 라이브러리는 동적 import + Suspense fallback (스파크라인 자체 SVG로 즉시 보여주기).
- 일봉 historical 데이터는 적어도 5년치 fetch + 클라이언트 가벼운 JSON으로 직렬화 (Date string 대신 unix timestamp number).
- 백테스트 실행은 별도 항목 (ADR-0019).

### K. 커밋 메시지
yutils 컨벤션 K 그대로. Conventional Commits. scope 후보 추가:
- `crypto`, `us`, `kr`, `backtest`, `charts`, `adapters/<provider>`, `cache`, `seo`, `theme`, `i18n`, `infra`, `deps`.

### L. 브랜치 / PR
yutils 컨벤션 L 그대로.

### M. 통화 & 시간대
- 내부 표시 통화는 **데이터 원본의 호가 통화**를 기본으로 한다. 코인은 USD·KRW 둘 다 라벨로 노출 (사이드바 토글 가능).
- 일자/시간은 모든 raw 데이터를 **UTC unix epoch**로 저장. 표시 시점에만 `Intl.DateTimeFormat`으로 `Asia/Seoul` 변환 (기본). 사용자가 설정에서 변경 가능.
- 한국 증시 휴장일(설/추석 등), 미국 휴장일(NYSE 캘린더) 처리는 어댑터 책임. 휴장 봉은 갭으로 표시.

### N. 데이터 출처 표기
- 모든 자산 페이지·랭킹·뉴스 하단에 **데이터 제공자 + 갱신 시각 + 지연도** 노출.
- 예: `Data: CoinGecko · 갱신 10초 전 · 실시간`, `Data: Yahoo Finance · 갱신 1분 전 · 15분 지연`.
- 차트 우측 하단 워터마크 형태로 작게.
- 위반 시 무료 API ToS 위반 위험. ADR-0017.

### O. 면책 고지
- 모든 페이지 푸터에 `투자 권유가 아니며 정보 제공 목적입니다. 거래 결과의 책임은 사용자 본인에게 있습니다.` 박힌다.
- 백테스트 결과 박스에는 별도로 `과거 성과는 미래 수익을 보장하지 않습니다.` 라벨 추가.
- ADR-0017에 문구·다국어 최종 확정.

### P. 백테스트 도메인 컨벤션
- 시간 단위: **1d (일봉) 기본, 1w·1mo 옵션. 분봉 이하는 명시적 미지원.**
- 자본: 초기 자본 디폴트 1,000,000 (통화는 자산군 따라).
- 거래 비용: 수수료·슬리피지 기본값 0.1% / 0.05% (사용자 변경 가능). KR 거래세 0.18% 옵션은 별도 토글.
- 룩어헤드 금지: 봉 종가로만 의사결정, 다음 봉 시가로 진입 (옵션: 종가 체결).
- 분할 매매 X (1차 출시), 항상 100% 포지션 또는 0%.
- 다중 종목 포트폴리오 X (1차 출시).
- 결과 1차 지표 셋: 총수익률, CAGR, MDD, Sharpe, 거래 수, 승률.
- ADR-0019·0020·0021에서 세부 잠금.

### Q. 외부 라이브러리 도입 정책
- yutils 컨벤션과 동일: 도구별 lazy import + Workers 호환 우선.
- 차트·데이터 라이브러리는 일반 도구보다 무겁기 때문에 PR 본문에 "왜 도입하는가 / 대안 / gzip 크기"를 명시.
- 절대 회피: `pandas-js`, `lodash` 전체 import, Node 전용 SDK (`@aws-sdk/*`, `firebase-admin` 등), 큰 ICU 데이터.

### R. DB 쿼리 · SQL dialect 회피 정책
- D1 채택(ADR-0021)이지만 **다른 SQL DB 이주 가능성을 항상 열어둔다**.
- **사용**: 표준 SQL + Drizzle ORM 쿼리 빌더. raw SQL은 마이그레이션·복잡 쿼리에만.
- **회피 (SQLite-specific)**:
  - ❌ `INSERT OR REPLACE` → ✅ `INSERT ... ON CONFLICT(...) DO UPDATE SET ...` (Postgres/SQLite 공통)
  - ❌ `json_extract(col, '$.key')` → application 레벨 parse 우선, 불가피 시 raw SQL 격리 + Drizzle `sql` template
  - ❌ `strftime('%Y', t, 'unixepoch')` → application Date 처리, `t INTEGER` 자체 인덱싱
  - ❌ SQLite FTS5 — 검색은 application 레벨 substring 또는 별도 검색 인덱스 ADR
  - ✅ `WITHOUT ROWID`, partial index, expression index — SQLite/Postgres 모두 OK 또는 마이그 시 무해
- **Repository 추상화 강제**: 페이지·백테스트 코드는 `lib/db/repos.ts` 인터페이스만 import. `lib/db/d1/*` 직접 import 금지.
- **마이그레이션 비용 상한 가정**: D1 → Turso 반나절, D1 → Postgres 1주. 이 상한을 넘는 SQL/스키마 패턴은 ADR 필요.

## 빌드·실행·테스트

| 항목 | 값 | 결정 ADR |
|---|---|---|
| 패키지 매니저 | bun (1.3+) | ADR-0002 |
| 런타임 | Node 22+ (로컬), Workers (배포) | ADR-0002 / 0003 |
| TypeScript | strict | ADR-0002 |
| 프레임워크 | Next.js 16 (App Router) + React 19 | ADR-0002 |
| 스타일 | Tailwind v4 (`@tailwindcss/postcss`) | ADR-0002 |
| Linter | ESLint 9 (flat config, `eslint-config-next`) | ADR-0002 |
| i18n | next-intl 4 (도입 시점에 ko만 활성, en 잠금) | ADR-0004 / 0007 |
| 어댑터 | `@opennextjs/cloudflare` | ADR-0003 |
| 테스트 | Vitest (1차 출시 후 도입) | — |

### 자주 쓰는 스크립트 (예정)

```bash
bun install
bun run dev            # Turbopack dev (http://localhost:3000 → /ko)
bun run build
bun run start
bun run lint
bun run typecheck

bun run cf:build       # opennextjs-cloudflare build
bun run cf:preview     # 로컬 Workers 시뮬레이션
bun run cf:deploy      # Cloudflare 배포
```

### 환경변수

| 키 | 용도 | dev 폴백 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | canonical · hreflang · OG · sitemap | `http://localhost:3000` |
| `COINGECKO_API_KEY` | (Demo / Pro 키 사용 시) | empty → free tier |
| `FINNHUB_API_KEY` 또는 `ALPHA_VANTAGE_API_KEY` | 해외주식 어댑터 | empty → fallback adapter |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | KIS 어댑터 사용 시 | empty → KRX/Naver fallback |

키 선택은 ADR-0005 / 0006 / 0007 채택 옵션에 따라 결정.

## Architecture

### 디렉토리 구조 (1차 부트 후 예정)

```
app/
  layout.tsx
  globals.css
  sitemap.ts
  robots.ts
  [locale]/
    layout.tsx            # AppShell + theme init + NextIntlClientProvider
    page.tsx              # 대시보드 (3 자산군 통합 위젯)
    crypto/
      page.tsx            # ticker list (sortable)
      gainers/page.tsx
      losers/page.tsx
      volume/page.tsx
      news/page.tsx
      [symbol]/page.tsx   # 종목 상세 + 백테스트 진입
    us/
      ... (crypto와 동일 구조, 라우트만 다름)
    kr/
      ... (코스피·코스닥 split 추가)
    backtest/
      new/page.tsx        # 전략 폼 + 결과
      saved/page.tsx
    search/page.tsx
    settings/page.tsx
components/
  AppShell.tsx            # yutils에서 차용 (sidebar + main)
  Header.tsx
  Footer.tsx
  LocaleSwitcher.tsx
  ThemeSwitcher.tsx
  ModeSwitcher.tsx
  ColorSemanticSwitcher.tsx   # 새로움: 한국식/글로벌식 토글
  SearchBox.tsx               # 자산군 통합 검색
  KeyboardShortcutsDialog.tsx
  charts/
    Candle.tsx
    Line.tsx
    Sparkline.tsx
    VolumeBars.tsx
  panels/
    QuoteCard.tsx
    RankingTable.tsx
    NewsList.tsx
    BacktestForm.tsx
    BacktestResultCard.tsx
lib/
  adapters/
    coingecko.ts
    binance.ts
    upbit.ts
    yahoo.ts
    finnhub.ts
    krx.ts
    naver-finance.ts
    rss.ts                    # RSS 파서
  symbols/
    normalize.ts              # 자산군별 심볼 정규화
    search.ts                 # 통합 검색 인덱스
  backtest/
    run.ts                    # 엔진 코어
    strategies/
      buy-and-hold.ts
      sma-crossover.ts
      rsi.ts
    indicators.ts             # SMA, EMA, RSI, MACD 등
    metrics.ts                # CAGR, MDD, Sharpe
  cache/
    edge.ts                   # cache API 래퍼
    kv.ts                     # KV 래퍼
    ttl.ts
  themes.ts
  site.ts
  storage.ts
  i18n/
    routing.ts
    request.ts
i18n/
messages/
  ko.json
  en.json (Phase 2)
middleware.ts                  # next-intl + locale routing
proxy.ts (?) — ADR-0024 패턴 차용 시
next.config.ts
open-next.config.ts
wrangler.jsonc
.env.example
.dev.vars                      # Workers 로컬 시크릿 (gitignore)
```

### 데이터 흐름 (요약)

```
[클라이언트]
   ↓ fetch('/api/<class>/quotes?...')
[Next.js Route Handler / RSC]
   ↓ cache.get(key)  ← Cloudflare Cache API
   ↓ (miss) → adapter.listQuotes()
   ↓ adapter normalizes → Quote[]
   ↓ cache.set(key, value, ttl)
[클라이언트]
   ↓ 상태 업데이트 + 차트 렌더
```

자세한 캐시 키·TTL·invalidation은 ADR-0009.

### 백테스트 흐름 (요약)

```
[사용자 입력]
  asset class + symbol + strategy(preset) + params + 기간
   ↓
[클라이언트]
  fetch('/api/<class>/candles?symbol=...&from=...&to=...&tf=1d')
   ↓ 일봉 OHLCV[] 받음 (서버에서 캐시됨)
[클라이언트 워커 또는 메인 스레드]
  lib/backtest/run.ts:
    for each candle:
      strategy.onBar(candle, state) → signal
      if signal === 'buy' && !position → enter at next open
      if signal === 'sell' && position → exit at next open
  → trades[] + equity curve[]
   ↓
[지표 계산] CAGR / MDD / Sharpe / 승률
   ↓
[차트] equity curve + 매수/매도 마커 + 비교 buy-and-hold
```

엔진 위치·전략 표현은 ADR-0019·0020.

### 라우팅 / i18n

- yutils와 동일하게 prefix-everywhere `/<lang>/<path>` (ADR-0006 차용).
- 1차 출시는 ko 단독, en 잠금 (ADR-0004 권장안).
- root `/` → `/ko` redirect.

### 테마 토큰

- yutils의 `lib/themes.ts` (12 라이트 프리셋 + system/light/dark axis)를 그대로 차용.
- 추가: `--color-up`, `--color-down` — 상승/하락 컬러. ADR-0012에서 한국식/글로벌식 디폴트 결정.

## 하네스: lab-trading (zero-agent 출발)

**목표:** 결정 일괄 확정 완료(2026-05-14), 셸 부트 진입 직전. 1차 출시(코인 + 해외주식 + 백테스트 MVP)까지 main agent 직접 조율로 충분. 자산군 3개 모두 점등 + 백테스트 본격 확장 시점에 도메인 에이전트(어댑터·차트·백테스트 검증) 도입 여부 재평가.

**현재 트리거 매핑:**

*결정 기록 / 문서:*
- "ADR", "결정 기록" → `adr-new` 스킬 (글로벌의 adr-new가 아직 없으면 프로젝트에 자체 추가)

*탐색 · 단순 작업:*
- 데이터 어댑터 1개 추가, 페이지 1개 점등 — main 직접
- 컴포넌트 추출·리네이밍 — main 직접

*기록:*
- 세션 종료 후 작업 기록 → 글로벌 `session-log` 스킬 (Obsidian 볼트: `~/claude-brain/claude-brain/LabTrading/`)
- "이전에 어떻게 했지?" → 글로벌 `vault-search`

**스킬 인벤토리 (예정):**
- `.claude/skills/adr-new/` — ADR 신규 작성 (yutils에서 복제)

**향후 후보 (지금은 만들지 않음):**
- `new-adapter` 스킬 — 데이터 어댑터 추가 표준화 (어댑터 5개+ 도달 후)
- `backtest-verify` 스킬 — 백테스트 결과 정합성 검증 (참조 벤치마크 대비)
- `data-adapter-builder` 에이전트 — 새 데이터 소스 통합 (8+ 어댑터 시점)
- `chart-reviewer` 에이전트 — 차트 컴포넌트 모바일/색맹/다크 회귀

**의도적으로 만들지 않는 것:**
- QA / 보안 리뷰 / DX 리뷰 — 글로벌 스킬(`qa`, `cso`, `devex-review`)이 이미 존재. 프로젝트 중복 불필요.

**Obsidian 매핑:**
- 글로벌 `~/.claude/claude-brain.json`에 `cwd: /Users/yusik/IdeaProjects/lab-trading → vault folder: LabTrading` 추가 필요. 첫 세션 로그 작성 시점에 등록.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-12 | 프로젝트 킥오프 — CLAUDE.md + ADR 시리즈(0000~0020) + DECISIONS.md + .claude/ 스캐폴드 | 전체 | 코인+해외+국내+백테스트 통합 사이트 신규 출범. yutils 패턴을 베이스로 트레이딩 도메인 컨벤션 추가 |
| 2026-05-13 | ADR-0021 추가 (Historical 데이터 + 지표 저장소) + 컨벤션 R (SQL dialect 회피 정책) 추가 | docs/adr/ADR-0021, CLAUDE.md 컨벤션 R, README 인덱스 | 사용자 질문 — "백테스트 지표 데이터 저장 + DB 마이그레이션 가능성". D1 + Drizzle + R2 백업으로 잠금, lock-in 최소화 정책 명시 |
| 2026-05-13 | 보조 ADR 4건 (0022~0025) + ADR-0019/0020 정합 갱신 + DESIGN_PREVIEW.md + RUN_PLAYBOOK.md + 결정 무관 인프라(.gitignore/.env.example/.editorconfig) + Obsidian 매핑 등록 | docs/adr/ADR-0022~0025, docs/DESIGN_PREVIEW.md, docs/RUN_PLAYBOOK.md, .gitignore, .env.example, .editorconfig, ~/.claude/claude-brain.json | 사용자 결정 대기 중 자율 진행 — 검색·분석·통화·휴장 보조 결정 + UI 와이어프레임 + 운영 절차로 검토 자료 풍부화 |
| 2026-05-14 | Phase 0 종료 — ADR-0001~0025 모두 `Accepted` 전환 + 각 ADR 헤더에 `결정 확정: 2026-05-14` 라인 추가 + DECISIONS.md 사용자 답변 박음 + README/CLAUDE/00-Index 동기화 | docs/adr/ADR-0001~0025, docs/adr/README.md, DECISIONS.md, README.md, CLAUDE.md, ~/claude-brain/claude-brain/LabTrading/00-Index.md | 사용자가 DECISIONS.md Q1-Q16 권장안 일괄 동의. Phase 1 셸 부트 진입 준비 완료 |
| 2026-05-15 | 도메인 최종 확정 — `trading.krutils.com` → `trading.jdgrid.com` 변경 + ADR-0018 변경 이력 추가 + .env.example/wrangler.jsonc/README/RUN_PLAYBOOK/DECISIONS 동기화 | docs/adr/ADR-0018, .env.example, wrangler.jsonc, README.md, docs/RUN_PLAYBOOK.md, DECISIONS.md | 사용자가 별도 보유 도메인 `jdgrid.com` 활용 — yutils 와 브랜드 분리, lab-trading 독립 자산으로 운영 |
| 2026-05-15 | Phase 1 핵심 가치 점등 — 셸 부트(yutils 차용) + 백테스트 코어(indicators/metrics/3 presets/engine, Vitest 62) + Binance/Upbit/Twelve Data(GBM demo)/KIS(GBM demo) 4 어댑터 + ADR-0010 model + 차트(Sparkline/Candle wrapper) + crypto/us/kr 인덱스+랭킹+상세 페이지 + 백테스트 라이브 UI + 대시보드(3 자산군 top movers + 백테스트 빠른 진입) + 통합 검색(정적 인덱스, ADR-0022) + 종목 상세 CTA + 자매 chips | app/, components/, lib/ (94 파일 / ~7700 줄), 12 feat 커밋, Vitest 93 ✓ | 키 없이 진행 가능한 모든 작업 마무리. 사용자가 Twelve Data + KIS 키 발급 후 즉시 라이브 전환 가능 |
| 2026-05-15 | Phase 1 깊이 + UX polish — CoinGecko 어댑터 추가 (5번째) + 코인 종목 상세에 USD/시가총액/순위 보조 + localStorage 즐겨찾기 ⭐ + 최근 본 ⏰ + 저장된 전략 (ADR-0016/0020) + 종목 상세 백테스트 미니뷰 (SSR runBacktest) + trades 표 (round-trip PnL) + 결과 URL 복사 + 404 catch-all 라우트 | app/[locale]/{[...path],backtest/saved,not-found}, components/{Favorite,Recent,Save,CopyResult,Saved,SymbolBacktest,Trades}, lib/{favorites,recents,strategies/saved} | 7 후속 커밋. 사용자 가치 명제 강화 — "한 화면에서 백테스트" 미니뷰 + 결과 공유 URL + 사용자 자산 (계정 없이 localStorage). Vitest 95 ✓ / 104 파일 / ~9080 줄 |
| 2026-05-15 | 운영·a11y·SEO polish — /api/health 라우트 (CF Workers uptime probe, 키 노출 X) + Settings 사용자 자산 일괄 reset 버튼 (favorites/recents/saved) + AppShell drag handle 키보드 a11y (Arrow ±8/32px, Home/End) + 종목 상세 JSON-LD (FinancialProduct + BreadcrumbList) + OpenGraph/Twitter card 메타 + 홈 WebSite + SearchAction schema (ADR-0015 D 정합) | app/api/health, components/panels/UserDataReset, components/AppShell, lib/seo/{asset,site}-jsonld, app/[locale]/{,crypto,us,kr}/[symbol]/page | 3 polish 커밋 + 운영 모니터링 진입점 + 검색 엔진 rich snippet 인식 기반 + 키보드 사용자 사이드바 resize. 107 파일 / ~9300 줄 |
| 2026-05-15 | **Production 배포 + 5년치 D1 backfill 라이브 점등 + KIS pagination fix** — Twelve Data/KIS 키 박음 → 5 어댑터 모두 live (Upbit/Binance/CoinGecko/Twelve/KIS). 35종목 × 49,091 candles + 48,232 indicators D1 채움 (2021-05-17 ~). `runtime="edge"` 제거 (opennextjs/cloudflare 라우팅 충돌 해소). D1 batch API 도입 — BTC 5년치 7m44s → 18s (25x). KIS `EGW00201` 회피 chunk 간 1100ms sleep + `EGW00133` 회피 KV 토큰 캐시 + error body 노출. backfill route 단일 종목 모드 (`?symbol=`) + partial-success chunk loop. 페이지 5곳 `loadCandleSeries` 헬퍼로 D1 우선 + 어댑터 fallback 전환. `trading.jdgrid.com` Custom Domain 연결. GitHub Actions `.github/workflows/cron-backfill.yml` 매일 06:00 UTC 증분 cron. | lib/data/candles.ts (신규), lib/db/d1/{client,repos}.ts, lib/backfill/run.ts, lib/adapters/kis.ts, app/api/{backfill,cron/backfill,health}/route.ts, app/[locale]/{,crypto,us,kr}/[symbol]/page.tsx + backtest/new, wrangler.jsonc, .github/workflows/cron-backfill.yml, docs/RUN_PLAYBOOK.md | 2 commits (9b8b3f7, a86a4fc) — Phase 1 마감. Vitest 97 ✓ / 105 파일 / ~9,800 줄. 도메인 지식 누적: Patterns 3 (D1 Batch API, KV-Backed OAuth Token Cache, Partial-Success Backfill) + Bugs 1 (runtime=edge in opennextjs/cloudflare) |
| 2026-05-16 | **Phase 2 — 회복성 + 뉴스 시스템 + 종목 80 확장** | 사용자 자율 진행 권한 누적 작업 5건: (1) D1 quote fallback 전 자산군 확장 (crypto/kr 페이지 + 랭킹 + D1FallbackBadge UI + health freshness + sitemap 35종목 추가). (2) 뉴스 라이브 점등 — 6 매체 RSS (한경 finance/economy + 매경 + 파이낸셜 stock/finance + 토큰포스트) D1 archive + KV hot cache + 30분 cron + 자산군 keyword cross-tag. (3) 종목 ↔ 관련 뉴스 매칭 — keyword OR LIKE + 종목 상세 섹션 + alias 80종목. (4) registry 35 → 80 (crypto +15 / us +18 / kr +12) — 107,668 candles + 106,809 indicators 채움. (5) Twelve Data 회복성 — getCandles status:"error" 분기 누락 회귀 fix + 분당 8 req 한도 8s sleep + callTwelve helper 통합 (discriminated union 패턴 일반화). | lib/{data/quotes,data/news,adapters/{rss,twelve-data},symbols/{registry,news-keywords},db/d1/{schema,repos}}, app/[locale]/{,crypto,us,kr}/news, app/[locale]/{,crypto,us,kr}/[symbol]/page, app/api/{health,cron/news-pull}, components/{D1FallbackBadge,panels/{NewsCard,NewsList,SymbolRelatedNews}}, .github/workflows/cron-news.yml, drizzle/0001 | 120+ 파일 / ~12,000 줄 / Vitest 98 ✓ / 198 sitemap URLs. 도메인 지식 추가: Patterns 2 (Quote D1 Fallback, Discriminated Union API Error Response) + Bug 회귀 1 (Twelve Data getCandles 누락 → endpoint 통합 helper) |
