# DECISIONS — 사용자 결정 체크리스트

> 아침 30분 안에 훑을 수 있도록 핵심 질문만 모은 문서. 각 항목에 **권장안 + 이유 1-2줄 + 관련 ADR** 표시.
> 답은 "권장 동의" / "다른 옵션 선택" / "추가 논의" 중 하나로 마크하면 됨.
> 자세한 트레이드오프는 `docs/adr/ADR-NNNN-*.md` 참조.

생성: 2026-05-12 (Claude Opus 4.7 자율 작업)
검토 권장 순서: 굵게 표시된 **[Q1]** 부터 위에서 아래로.

---

## 검토 결과 요약 (조사 완료 항목)

자고 있는 동안 백그라운드로 진행한 외부 조사:

| 영역 | 핵심 결론 |
|---|---|
| 코인 API | **CoinGecko Demo + Upbit + Binance** 3축 무료 + 합법. CoinMarketCap은 비상업 한정. |
| 해외 API | **Twelve Data 단독** (글로벌 + 랭킹 + 상업 OK). Yahoo unofficial은 ToS 위험. |
| 국내 API | **KIS + KRX + 공공데이터포털 + OpenDART** 4종 공식. **네이버 unofficial은 명시적 제외** (법적 위험 큼). |
| RSS | 한경 + 매경 + 파이낸셜뉴스 (헤드+요약+링크 패턴 안전). Investing.com / 연합뉴스는 라이선스 필요. |
| 차트 | **lightweight-charts v5 + 자체 SVG Sparkline**. 38KB + 5KB. |

---

## **[Q1] 1차 출시 스코프 — Phase 1에 무엇을 점등?**

**권장:** 코인 + 해외주식 + 백테스트 MVP. 국내주식은 Phase 1.5, 뉴스는 Phase 2.

**이유:** 코인+해외는 데이터 API 호환성·법적 안전성·운영 비용 모두 좋음. 국내는 KIS 계좌 발급 진입장벽 + 법적 회색지대 회피 필요. 백테스트는 사용자 명시 요구 + 차별화 핵심.

- 동의 → ADR-0001 그대로
- 다르게 → 1차에 국내 포함 / 백테스트 제외 / 코인만 등 선택

→ ADR-0001

---

## **[Q2] 기술 스택 — yutils 그대로?**

**권장:** Next.js 16 + React 19 + Tailwind v4 + next-intl 4 + bun + `@opennextjs/cloudflare`. yutils 컴포넌트(AppShell, ToolsSidebar, ThemeSwitcher 등) 그대로 차용.

**이유:** 사용자가 "UI 기반은 똑같고"라고 명시. 같은 스택이 컴포넌트 재사용·CF 배포 학습 비용 0.

- 동의 → ADR-0002·0003 그대로
- 다르게 → Vite/Remix 등

→ ADR-0002, ADR-0003

---

## **[Q3] i18n — 1차 출시는 한국어만?**

**권장:** ko 단독 출시 + i18n 인프라(next-intl prefix-everywhere)만 잠금. en은 messages 스켈레톤만, 활성화는 Phase 2.

**이유:** 카피 작성 비용 절반. 영어 활성화는 messages 파일만 채우면 1줄 변경으로 즉시.

- 동의 → ADR-0004 그대로
- 다르게 → 처음부터 한·영 동시 (yutils ADR-0003 패턴)

→ ADR-0004

---

## **[Q4] 코인 데이터 — CoinGecko Demo + Upbit + Binance?**

**권장:** 세 어댑터 조합. CoinGecko Demo는 무료 키 1개 발급 필요 (https://www.coingecko.com/en/developers/dashboard).

**역할:**
- CoinGecko: 글로벌 랭킹, 시가총액, 메타데이터, 로고
- Upbit: KRW 페어 시세 (한국 사용자 디폴트 표시)
- Binance: 글로벌 페어 + 일봉 historical (백테스트 데이터)

**이유:** 모두 무료 + 상업적 사용 허용 + fetch 호환. CoinMarketCap은 비상업 한정.

- 동의 → ADR-0005 그대로
- 다르게 → CoinGecko 단독 / CryptoCompare 사용 / Bithumb 추가

→ ADR-0005

---

## **[Q5] 해외 주식 데이터 — Twelve Data 단독?**

**권장:** Twelve Data 무료 (800/day, 8/min). 글로벌 90+ 거래소 + market_movers 무료 + 상업적 사용 명시 허용.

**키 발급:** https://twelvedata.com/account/api-keys (무료 가입)

**이유:** "상승률/하락률/거래량 랭킹"을 무료로 + 상업적으로 제공하는 거의 유일한 글로벌 단일 API. Yahoo unofficial은 ToS 위반 위험.

**Phase 1.5+ 옵션:**
- 펀더멘털 강화 → FMP 추가
- US 실시간 정확도 → Polygon snapshot 추가

- 동의 → ADR-0006 그대로
- 다르게 → Polygon+FMP+Finnhub 조합 (Pattern B) / Yahoo 사용

→ ADR-0006

---

## **[Q6] 국내 주식 데이터 — KIS + KRX + 공공데이터포털 + OpenDART?**

**중대한 결정** — Phase 1.5 진행에 사용자 작업이 필요함.

**권장:** 4개 공식 소스 + 네이버/다음 unofficial 명시적 제외.

**사용자 작업 필요 (Phase 1.5 진행 전):**
1. 한국투자증권 비대면 계좌 개설 + 모의투자 가입 → AppKey/Secret 발급
   - https://apiportal.koreainvestment.com/intro
2. KRX OPEN API 가입 + 키 발급
   - https://openapi.krx.co.kr/
3. 공공데이터포털 가입 + "금융위 주식시세정보" API 신청 (자동승인)
   - https://www.data.go.kr/data/15094808/openapi.do
4. OpenDART 가입 + 키 발급
   - https://opendart.fss.or.kr/

**이유:** 네이버/다음 unofficial은 ToS 위반 + IP 차단 위험 + 한국 commercial 사이트에 매우 위험. KIS의 진입장벽을 한 번만 넘으면 운영 안정성 압도적.

- 동의 → ADR-0007 그대로 + 계좌 발급 진행
- 다르게 → 네이버 unofficial로 출발 후 운영 직전 KIS 마이그레이션 / Phase 1.5 자체 포기 / 키움 또는 LS증권

→ ADR-0007

---

## **[Q7] 뉴스 / RSS — 4개 매체?**

**권장:** Phase 2에 점등. 1차는 메뉴 stub. 활성화 시 한국경제 + 매일경제 + 파이낸셜뉴스 + 토큰포스트.

**이유:** 일반 RSS 관행(헤드+요약+링크) 내 안전. Investing.com·연합뉴스는 라이선스 필요로 제외. 1차 출시 가치 명제 우선순위에서 후순위.

- 동의 → ADR-0008 그대로
- 다르게 → 1차에 뉴스 포함 / 매체 추가/제거

→ ADR-0008

---

## **[Q8] 차트 라이브러리 — lightweight-charts + 자체 SVG?**

**권장:** TradingView Lightweight Charts v5 (메인 캔들·백테스트 곡선) + 자체 SVG (대시보드·랭킹 스파크라인).

**번들:** ~38KB (lightweight-charts, dynamic import) + ~5KB (자체 SVG, RSC 호환). 평균 페이지 무게 영향 거의 0.

**이유:** 금융 전용 라이브러리 가성비 압도적. Recharts/ECharts/Plotly/Highcharts는 캔들 품질·번들·라이선스 중 하나에서 떨어짐.

- 동의 → ADR-0011 그대로
- 다르게 → ECharts 단독 / Recharts / 모두 자체 SVG

→ ADR-0011

---

## **[Q9] 상승/하락 컬러 — 한국식 (빨강=상승) 디폴트?**

**권장:** 한국식 (빨강=상승, 파랑=하락) 디폴트 + Settings에서 글로벌식(초록=상승, 빨강=하락) 토글.

**이유:** 1차 출시 타깃이 한국어 사용자. 토스/키움/네이버/다음 모두 한국식. 글로벌 자산도 통일된 컬러 시맨틱이 인지 부조화 적음.

- 동의 → ADR-0012 그대로
- 다르게 → 글로벌 디폴트 / 자산군별 자동 전환

→ ADR-0012

---

## **[Q10] 카테고리·메뉴 구조 — 자산군별 5 하위?**

**권장:** 대시보드 + 자산군(crypto·us·kr) 그룹 × 시세/gainers/losers/volume/news + 백테스트.

1차 출시 시 국내(kr)·뉴스(news)는 사이드바에 표시하되 "준비 중" disabled 라벨.

- 동의 → ADR-0014 그대로
- 다르게 → stub 항목 숨김 / 메뉴 구조 변경

→ ADR-0014

---

## **[Q11] 1차 출시 페이지 셋 — 대시보드 + 각 자산군 시세/3 랭킹 + 종목 상세 + 백테스트?**

**권장:** ADR-0015 표 그대로. 활성 라우트 14개 + stub 라우트 6개.

**놓친 항목 (Phase 1.1로 1주 내 추가 예정):**
- `/backtest/saved` (저장된 전략 목록) — 1차 출시 직후
- 동적 OG 이미지 — Phase 2

- 동의 → ADR-0015 그대로
- 다르게 → 페이지 추가/삭제

→ ADR-0015

---

## **[Q12] 사용자 데이터 — localStorage 단독?**

**권장:** 1차 출시는 localStorage 단독, 계정 없음. 가입은 Phase 3+ 검토.

**이유:** 정보 사이트 + 매매 X. 계정 가치는 cross-device 동기화 정도. 개인정보 처리 0이라 GDPR/개인정보보호법 부담 없음.

- 동의 → ADR-0016 그대로
- 다르게 → 1차에 가입 도입

→ ADR-0016

---

## **[Q13] 도메인 — `trading.krutils.com` 서브?**

**권장:** `trading.krutils.com` (기존 `krutils.com` 서브). 비용 0 + yutils 자매 사이트 인지.

**대안 서브:** `lab.krutils.com`, `markets.krutils.com`, `finance.krutils.com`.

**Phase 2+ 옵션:** 별도 도메인 등록 (`labtrading.io`, `labtrading.app`).

- 동의 (trading.krutils.com) → ADR-0018 그대로
- 다른 서브 선택
- 새 도메인 등록

→ ADR-0018

---

## **[Q14] 백테스트 엔진 — 브라우저 클라이언트?**

**권장:** 1차 출시는 브라우저 메인 스레드 / Phase 1.1에 Web Worker 이전. 데이터 fetch는 서버 캐시 경유.

**디폴트 파라미터:**
- 일봉 깊이: 5년 기본, 최대 10년
- 체결: 다음 봉 시가 (룩어헤드 회피)
- 수수료 0.10% / 슬리피지 0.05% / KR 거래세 0.18% (옵션)
- 포지션: 100% or 0% (분할 매매는 Phase 2)
- 비교 baseline: buy-and-hold 자동 포함

- 동의 → ADR-0019 그대로
- 다르게 → CF Workers 실행 / 분봉 지원 / 다른 디폴트

→ ADR-0019

---

## **[Q15] 백테스트 전략 표현 — Preset 3종으로 출발?**

**권장:** 1차 출시는 Preset 3종(buy-and-hold, sma-cross, rsi-reversion). Phase 2에 MACD/Bollinger 추가. JSON DSL은 Phase 2.5+.

**이유:** 사용자 학습 곡선 ↓ + 보안 위험 0. 사용자 코드 eval 없음.

- 동의 → ADR-0020 그대로
- 다르게 → JSON DSL 1차 도입 / Preset 추가 / 함수 사용자 정의

→ ADR-0020

---

## **[Q16] Historical 저장소 — Cloudflare D1 + Drizzle ORM + 주간 R2 백업?**

**권장:** D1(SQLite, 무료 5 GB)에 일봉 OHLCV + 사전계산 지표 17종(SMA/EMA/RSI/MACD/BB/ATR/VolSMA)을 영구 저장. Drizzle ORM으로 dialect 추상화. 매주 R2에 백업.

**사이즈 추정 (압축 후):**
- 1차 출시 (인기 종목 sparse, 5년): ~80 MB
- Phase 2 (전체 추적, 10년): ~1.8 GB
- Phase 3 (15년+): ~2.5 GB
- → **Phase 3까지 D1 무료 5 GB 한도 안에 들어옴**

**이유:**
- 백테스트 결과의 결정론성·정확성 보장 (사전계산 지표 + `computed_version` 컬럼)
- 외부 도구(TradingView/Investing)와 cross-check 가능
- Repository 추상화 + Drizzle + 표준 SQL → **D1 lock-in 매우 낮음** (Postgres 이주 시 1주 상한)
- R2 백업으로 D1 장애·마이그레이션 대비

**마이그레이션 친화도:**
| 목적지 | 비용 |
|---|---|
| 로컬 SQLite | 수 시간 |
| Turso (libSQL) | 반나절 |
| Neon/Supabase (Postgres) | 1주 |
| PlanetScale (MySQL) | 1-2주 |

**컨벤션 R 추가** (CLAUDE.md): SQLite-specific SQL 회피 — `INSERT OR REPLACE` 대신 `ON CONFLICT DO UPDATE`, `json_extract` 회피, FTS5 회피, Repository 인터페이스 강제.

- 동의 → ADR-0021 + 컨벤션 R 그대로
- 다르게 → Turso 단독 / KV에 JSON blob / R2 parquet 단독 / DO+SQLite / Postgres

→ ADR-0021

---

## 결정 약함 (확인만)

자고 일어나서 가볍게 확인만 해도 되는 항목들:

| 영역 | 권장 | ADR |
|---|---|---|
| 호스팅 | Cloudflare Workers + `@opennextjs/cloudflare` (사용자 명시) | ADR-0003 |
| 캐싱 | Cache API (PoP-local) + KV (글로벌 폴백), 자산군별 TTL | ADR-0009 |
| Historical 저장소 | D1(영구) + KV(짧은 TTL 캐시) + R2(주간 백업) 역할 분리 | ADR-0021 |
| 통합 검색 | 정적 인덱스 (자산군별 top 500) + D1 LIKE fallback + 한글 alias | ADR-0022 |
| 분석/모니터링 | CF Web Analytics + Workers Logs + Analytics Engine (모두 무료) | ADR-0023 |
| 통화 표시 | 호가 우선 + 보조 변환 ("$150 ≈ ₩201,000"), 환율은 Frankfurter | ADR-0024 |
| 휴장·분할·배당 | 1차는 split-adjusted (어댑터 책임), 배당 미반영 (Price return only). Phase 2 total return 옵션 | ADR-0025 |
| 데이터 모델 | `AssetClass`/`Quote`/`Candle` 공통 인터페이스 + 어댑터 normalize | ADR-0010 |
| 실시간 | 폴링 (15-60s 자산군별), WS는 Phase 2 | ADR-0013 |
| 면책 | 표준 면책 + 백테스트 별도 박스 + 출처 표기 | ADR-0017 |

---

## 사용자 작업 요약 (결정 후)

권장안을 모두 채택한다고 가정할 때 사용자가 해줘야 할 외부 작업:

### 1차 출시 (Phase 1)
- [ ] CoinGecko Demo API 키 발급 (`COINGECKO_API_KEY`)
- [ ] Twelve Data API 키 발급 (`TWELVE_DATA_API_KEY`)
- [ ] CF Workers 배포 환경 준비 (`bunx wrangler login`)
- [ ] 도메인 `trading.krutils.com` (또는 선택 서브) CF DNS CNAME 셋업
- [ ] D1 namespace 생성 (`wrangler d1 create lab-trading-db`) + binding `DB`
- [ ] R2 bucket 생성 (`wrangler r2 bucket create lab-trading-backup`) + binding `BACKUP`

### Phase 1.5 (국내 주식 점등)
- [ ] 한국투자증권 계좌 + 모의투자 + AppKey/Secret
- [ ] KRX OPEN API 키
- [ ] 공공데이터포털 가입 + 금융위 주식시세정보 키
- [ ] OpenDART 키

### Phase 2 (뉴스)
- [ ] 매체별 RSS URL 운영 직전 1회 점검 (한경 / 매경 / 파이낸셜뉴스 / 토큰포스트)
- [ ] (옵션) 약관 / 개인정보 처리방침 페이지 (`/legal/terms`, `/legal/privacy`)

### 운영 (선택)
- [ ] 변호사 1회 검토 (자본시장법 면책 문구)
- [ ] 분석 도구 도입 결정 (Plausible / Vercel Analytics — 별도 ADR)

---

## 사용자 답변 (2026-05-14 확정)

```
[Q1]  동의 — 1차 출시: 코인 + 해외주식 + 백테스트 MVP / 국내 Phase 1.5 / 뉴스 Phase 2
[Q2]  동의 — Next.js 16 + React 19 + Tailwind v4 + next-intl 4 + bun + @opennextjs/cloudflare
[Q3]  동의 — ko 단독 출시, en 인프라만 잠금
[Q4]  동의 — CoinGecko Demo + Upbit + Binance 3축
[Q5]  동의 — Twelve Data 단독
[Q6]  동의 — KIS + KRX + 공공데이터포털 + OpenDART (네이버 unofficial 명시적 제외)
[Q7]  동의 — Phase 2 RSS 4매체
[Q8]  동의 — lightweight-charts v5 + 자체 SVG Sparkline
[Q9]  동의 — 한국식 디폴트 (빨강=상승), Settings 토글 글로벌식
[Q10] 동의 — 자산군 × 시세/gainers/losers/volume/news + 백테스트 + stub disabled
[Q11] 동의 — ADR-0015 페이지 셋 그대로
[Q12] 동의 — localStorage 단독, 가입 Phase 3+
[Q13] 동의 — trading.krutils.com
[Q14] 동의 — 브라우저 메인 스레드 (1.1 Web Worker)
[Q15] 동의 — Preset 3종 (buy-and-hold / SMA-cross / RSI-reversion)
[Q16] 동의 — D1 + Drizzle + 주간 R2 백업 + 컨벤션 R
```

→ ADR-0001~0025 모두 `Accepted`로 일괄 전환 (2026-05-14).
→ Phase 0 종료. 다음: yutils 차용 셸 부트 → 첫 어댑터(CoinGecko) → BTC 종목 상세 end-to-end.

---

## 모든 ADR 한눈에

전체 ADR 인덱스는 [docs/adr/README.md](docs/adr/README.md). 핵심 결정 21건 + 메타 1건.
