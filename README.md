# lab-trading

코인 · 해외주식 · 국내주식 통합 정보 사이트 + **일봉 백테스트 랩**.

세 자산군의 시세·랭킹을 한 곳에서 비교하고, 같은 화면에서 사용자 전략을 일봉 기준으로 백테스트하여 수익률·MDD·Sharpe 결과를 즉시 확인할 수 있다.

## 현재 상태 (2026-05-15)

**Production 라이브 — <https://trading.jdgrid.com>**. 3 자산군 × 시세·랭킹·종목상세·백테스트 모두 **라이브 데이터** + **D1 historical 5년치 (49,091 candles + 48,232 indicators)** 채워짐.

| 자산군 | 데이터 | 상태 | D1 채움 |
|---|---|---|---|
| **crypto** | Upbit Public API (KRW) + CoinGecko 보조 (USD / mcap / rank) | **라이브** — 11 코인 | 19,506 candles (5년 8 + 상장한도 3) |
| **us** | Twelve Data | **라이브** — 12 종목 | 15,072 candles (12종 × 1256 영업일봉) |
| **kr** | KIS Open API | **라이브** — 12 종목 | 14,513 candles (KIS pagination fix 후 5년치) |

페이지·백테스트는 `lib/data/candles.ts` 의 `loadCandleSeries` 헬퍼로 **D1 우선 + 어댑터 fallback**. backfill 가 채운 D1 가 적중하면 외부 API 호출 0회.

활성 라우트: 대시보드 + 3 자산군 × {인덱스, gainers, losers, volume, 종목상세} + 백테스트 작업장 + 저장된 전략 + 통합 검색 + 설정 + 404 + `/api/{health,backfill,cron/backfill}`.

**운영**:
- **CF Workers** — `lab-trading.jason-parsing.workers.dev` + Custom Domain `trading.jdgrid.com`. wrangler secrets 9개.
- **Cron** — GitHub Actions 매일 06:00 UTC `/api/cron/backfill` 호출 (`opennextjs/cloudflare` 가 fetch handler 만 export → 외부 cron 패턴). 워크플로 `.github/workflows/cron-backfill.yml`.
- **KV 토큰 캐시** — `lab_trading_cache` 에 KIS OAuth 토큰 저장 (cold start `EGW00133` 1분 한도 회피).

**사용자 자산** (localStorage, ADR-0016): 즐겨찾기 ⭐ + 최근 본 종목 ⏰ + 저장된 백테스트 전략 (URL prefill 공유 가능). Settings 에서 일괄 reset.
**종목 ↔ 백테스트 연결**: 종목 상세 페이지 안에 buy-and-hold 미니뷰 (SSR runBacktest) + ⚡ 전체 백테스트 CTA + 자매 종목 chip nav.
**SEO** (ADR-0015 D): 종목 상세에 schema.org FinancialProduct + BreadcrumbList JSON-LD + OpenGraph + Twitter card. 홈에 WebSite + SearchAction.
**a11y**: AppShell drag handle 키보드 (Arrow ±8px, Shift+Arrow ±32px, Home/End), 컬러 + 부호/화살표 병기, role=combobox 검색.

코드: TypeScript strict / ESLint 9 / **Vitest 97 ✓** (105 파일 / ~9,800 줄).

## 빌드 / 실행

```bash
bun install                 # 의존성 (~660 패키지)
bun run dev                 # http://localhost:3000/ko (Turbopack)
bun run typecheck           # tsc --noEmit (strict)
bun run test                # Vitest run-once
bun run test:watch          # Vitest watch
bun run build               # Next.js build
bun run cf:build            # opennextjs-cloudflare build
bun run cf:deploy           # CF Workers 배포 (wrangler 로그인 필요)
bun run db:generate         # Drizzle 마이그레이션 SQL 생성
```

## 데이터 소스 키 발급 (라이브 전환)

키 발급 후 `.dev.vars` 또는 `wrangler secret put`:

| 자산군 | 환경 변수 | 발급 링크 | 라이브 효과 |
|---|---|---|---|
| us | `TWELVE_DATA_API_KEY` | https://twelvedata.com/account/api-keys | `/us/*` 실시간 시세 + 5년 historical |
| kr | `KIS_APP_KEY` / `KIS_APP_SECRET` | https://apiportal.koreainvestment.com/intro | `/kr/*` 실시간 시세 (사용자 계좌 + 모의투자 필요, ADR-0007) |

키 없이도 `/crypto/*` 는 Upbit 라이브 + `/us/*` `/kr/*` 는 deterministic GBM 더미로 모든 페이지 동작.

## 아키텍처 한눈

```
사용자 ──▶ Cloudflare Workers (Next 16 + @opennextjs/cloudflare)
            │
            ├─ RSC (server component)
            │   ├─ DataAdapter (ADR-0010) — 5 어댑터
            │   │   ├─ upbitAdapter        (crypto / KRW / Upbit Public · 라이브)
            │   │   ├─ binanceAdapter      (crypto / USDT / Binance Public · 라이브)
            │   │   ├─ coingeckoAdapter    (crypto / USD / 시가총액·순위·로고 보조)
            │   │   ├─ twelveDataAdapter   (us / USD / 키 자동 분기)
            │   │   └─ kisAdapter          (kr / KRW / 키 자동 분기 · 호가 quantize)
            │   └─ runBacktest()           (pure function — RSC 에서 직접 호출 가능,
            │                              종목 상세 미니뷰에 활용)
            │
            ├─ Client Component
            │   ├─ BacktestPanel  → runBacktest + URL 복사 + 전략 저장
            │   ├─ CandleChart    → lightweight-charts v5 (dynamic, ssr:false)
            │   ├─ Sparkline      → 자체 SVG (RSC 호환)
            │   ├─ LineChart      → 자체 SVG multi-series (equity curve, RSC 호환)
            │   ├─ SearchBox      → 정적 인덱스 36 종목 (Phase 1.5 D1 fallback)
            │   ├─ FavoriteButton ⭐ + RecentTracker ⏰  → localStorage
            │   └─ SavedStrategiesPanel    → /backtest/saved
            │
            └─ 저장소 (Phase 1.5+, ADR-0021)
                ├─ D1 — historical 5y candles + indicators 17 (사전계산)
                ├─ KV — 글로벌 캐시 (시세 30s, 랭킹 5min)
                └─ R2 — 주간 SQL dump 백업
```

## 백테스트 엔진 (ADR-0019/0020)

- **3 preset**: Buy and Hold · SMA Crossover · RSI Reversion
- **체결**: 다음 봉 시가 (룩어헤드 회피) / 같은 봉 종가 옵션
- **비용**: 수수료 0.10% + 슬리피지 0.05% + KR 거래세 0.18% (옵션)
- **포지션**: 100% or 0% (단일 자산 단일 포지션, 분할 매매는 Phase 2)
- **지표**: 17종 사전계산 가능 (SMA 5/20/50/100/200, EMA 12/26/50, RSI14, MACD/BB/ATR/VolSMA) — D1 indicators 우선, 사용자 정의 파라미터는 streaming fallback
- **메트릭스**: Total Return / CAGR / MDD / Sharpe / Sortino / Win Rate / Trade Count / Avg Hold Days
- **결정론**: 같은 입력 → 같은 결과 (Vitest 12 ✓)

## 기술 스택

| 항목 | 값 | 결정 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | ADR-0002 |
| 런타임 | React 19 + Node 22+ | ADR-0002 |
| 스타일 | Tailwind v4 + 자체 토큰 | ADR-0002 |
| i18n | next-intl 4 (ko 단독, en 스켈레톤) | ADR-0004 |
| 패키지 매니저 | bun 1.3+ | ADR-0002 |
| 배포 | Cloudflare Workers + `@opennextjs/cloudflare` | ADR-0003 |
| 차트 | TradingView Lightweight Charts v5 + 자체 SVG | ADR-0011 |
| DB | Cloudflare D1 (SQLite) + Drizzle ORM | ADR-0021 |
| 테스트 | Vitest 4 (node env) | — |

## 결정 추적

- [`docs/adr/`](docs/adr/) — ADR-0000~0025 (26건, 모두 Accepted)
- [`DECISIONS.md`](DECISIONS.md) — 사용자 결정 체크리스트 (Q1-Q16 완료)
- 새 결정은 `adr-new` 슬래시 스킬로

## 다음 단계

1. **사용자 키 발급** (Phase 1.5 시작 조건):
   - Twelve Data 무료 — 미장 `/us/*` 라이브
   - KIS 계좌 + 모의투자 — 국내 `/kr/*` 라이브
2. **D1 namespace 생성** + Drizzle 마이그레이션 apply + indicators 사전계산 backfill (cron)
3. **Cloudflare 배포** + 도메인 `trading.jdgrid.com` CNAME (ADR-0018)
4. **Phase 2 후보**: 뉴스 RSS 활성화 / 영어 i18n / Web Worker 백테스트 이전 (Phase 1.1) / 백테스트 결과 PDF 또는 이미지 export

## 문서

- [`CLAUDE.md`](CLAUDE.md) — 프로젝트 가이드라인, 컨벤션 A-R, 아키텍처, 하네스
- [`DECISIONS.md`](DECISIONS.md) — 사용자 결정 체크리스트
- [`docs/adr/`](docs/adr/) — Architecture Decision Records (26건, 모두 Accepted)
- [`docs/DESIGN_PREVIEW.md`](docs/DESIGN_PREVIEW.md) — ASCII 와이어프레임
- [`docs/RUN_PLAYBOOK.md`](docs/RUN_PLAYBOOK.md) — 운영 절차, 장애 대응, 출시 체크리스트

## 자매 프로젝트

- [yutils](../yutils) — 온라인 무료 도구 모음. UI 톤·AppShell·라우팅·하네스 패턴을 차용한 원본. 라이브: <https://devtools.krutils.com/ko>
