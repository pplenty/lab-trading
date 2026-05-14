# lab-trading

코인 · 해외주식 · 국내주식 통합 정보 사이트 + **일봉 백테스트 랩**.

세 자산군의 시세·랭킹·뉴스를 한 곳에서 비교하고, 같은 화면에서 사용자 전략을 일봉 기준으로 백테스트하여 수익률·MDD·Sharpe 결과를 즉시 확인할 수 있다.

## 현재 상태 (2026-05-14)

**Phase 0 종료 — 결정 일괄 확정.** ADR-0001~0025 모두 `Accepted` ([`DECISIONS.md`](DECISIONS.md) Q1-Q16 권장 동의). 코드는 여전히 0 줄, 셸 부트 진입 직전.

산출물:
- `CLAUDE.md` — 프로젝트 가이드, 컨벤션 A-R, 아키텍처, 하네스
- `DECISIONS.md` — 사용자 결정 체크리스트 Q1-Q16 + 확정 답변
- `docs/adr/` — ADR-0000~0025 (26개, **모두 Accepted**)
- `docs/DESIGN_PREVIEW.md` — ASCII 와이어프레임
- `docs/RUN_PLAYBOOK.md` — 운영 절차 / 장애 대응 / 출시 체크리스트
- `.claude/skills/adr-new/` — ADR 작성 스킬
- `.env.example`, `.gitignore`, `.editorconfig`

## 다음 단계

1. **셸 부트 (yutils 차용)** — `package.json` + `wrangler.jsonc` + `next.config.ts` + `middleware.ts` + `open-next.config.ts`
2. **AppShell·테마 시스템 차용** — `app/layout.tsx` + `app/[locale]/layout.tsx` + `lib/themes.ts` + `components/AppShell.tsx` + `Header`/`Footer`/`ThemeSwitcher` 등
3. **DB 스키마 + 어댑터 인터페이스** — `lib/db/d1/schema.ts` (Drizzle, candles/indicators/assets) + `lib/types.ts` (Asset/Quote/Candle/IndicatorRow) + `lib/adapters/types.ts`
4. **첫 어댑터 점등** — `lib/adapters/coingecko.ts` (DataAdapter 인터페이스 검증) + BTC 종목 상세 페이지 1개 (`/ko/crypto/btc`) — 셸 → 어댑터 → 차트 → 통계 end-to-end
5. **백테스트 MVP** — buy-and-hold BTC 5년 점등
6. **Twelve Data + 해외 자산군 점등** → Phase 1 출시

## 기술 스택 (예정)

| 항목 | 값 | 결정 |
|---|---|---|
| 프레임워크 | Next.js 16 (App Router) | ADR-0002 |
| 런타임 | React 19 + Node 22+ | ADR-0002 |
| 스타일 | Tailwind v4 + 자체 토큰 | ADR-0002 |
| i18n | next-intl 4 (ko 단독) | ADR-0004 |
| 패키지 매니저 | bun 1.3+ | ADR-0002 |
| 배포 | Cloudflare Workers + `@opennextjs/cloudflare` | ADR-0003 |
| 차트 | TradingView Lightweight Charts v5 + 자체 SVG Sparkline | ADR-0011 |

## 데이터 소스 (예정)

| 자산군 | 1차 출시 | Phase 1.5+ |
|---|---|---|
| 코인 | CoinGecko Demo + Upbit + Binance | DefiLlama (DeFi 보강) |
| 해외주식 | Twelve Data | FMP / Polygon (펀더멘털·정확도 보강) |
| 국내주식 | (Phase 1.5) KIS + KRX + 공공데이터포털 + OpenDART | — |
| 뉴스 | (Phase 2) 한경 + 매경 + 파이낸셜뉴스 + 토큰포스트 | — |

## 결정 추적

모든 결정은 [`docs/adr/`](docs/adr/) ADR로 박는다. 인덱스: [`docs/adr/README.md`](docs/adr/README.md).

새 결정은 `adr-new` 슬래시 스킬로.

## 문서

- [`CLAUDE.md`](CLAUDE.md) — 프로젝트 가이드라인, 컨벤션, 아키텍처
- [`DECISIONS.md`](DECISIONS.md) — 사용자 결정 체크리스트 (아침 검토용)
- [`docs/adr/`](docs/adr/) — Architecture Decision Records (26건, 모두 Accepted)
- [`docs/DESIGN_PREVIEW.md`](docs/DESIGN_PREVIEW.md) — ASCII 와이어프레임 (대시보드, 종목 상세, 백테스트)
- [`docs/RUN_PLAYBOOK.md`](docs/RUN_PLAYBOOK.md) — 운영 절차, 장애 대응, 출시 체크리스트

## 자매 프로젝트

- [yutils](../yutils) — 온라인 무료 도구 모음. UI 톤·AppShell·라우팅·하네스 패턴을 차용한 원본. 라이브: <https://devtools.krutils.com/ko>
