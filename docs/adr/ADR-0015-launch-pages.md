# ADR-0015: 1차 출시 페이지 셋

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0001 (스코프), ADR-0014 (메뉴)

## 컨텍스트

ADR-0001에서 1차 출시 스코프는 "코인 + 해외주식 + 백테스트 MVP". 구체적으로 어떤 페이지를 점등할지, 각 페이지의 콘텐츠 셋과 출시 기준(definition of done)을 잠금.

## 검토한 옵션

### A. 최소 출시 (대시보드 + 자산군 인덱스 + 백테스트 폼)
- 장점: 1주 출시 가능.
- 단점: 랭킹·종목 상세 누락 — "정보 사이트" 가치 부족.

### B. 전체 출시 (대시보드 + 자산군 × 시세/gainers/losers/volume + 종목 상세 + 백테스트 + Settings + Search)
- 장점: 사용자 만족도 ↑.
- 단점: 작업량 ↑.

### C. 중간 (대시보드 + 자산군별 메인+랭킹 3종 + 종목 상세 + 백테스트 새 전략 + Settings + Search)
- 장점: 핵심 가치 모두 포함하면서 작업량 통제.
- 단점: 백테스트 결과 저장(`/backtest/saved`)이 Phase 2로 밀림.

## 결정

**옵션 C 채택 권장.**

근거:
1. 정보 사이트 가치 명제(시세·랭킹·차트) + 백테스트 차별화를 모두 포함.
2. 사용자 데이터(`/backtest/saved`)는 1차 출시 직후 추가 가능 (localStorage 단독이라 어려움 없음).
3. `Search`는 yutils 패턴 그대로 차용 가능.

**1차 출시 페이지 셋:**

| 라우트 | 콘텐츠 | 데이터 |
|---|---|---|
| `/ko` | 대시보드: 3 자산군 통합 위젯 (top 5 gainers, top 5 by mcap, 주요 지수 카드, 최근 외부 링크) | 코인 + us 활성, kr은 stub |
| `/ko/crypto` | 코인 시세 인덱스 (시가총액 정렬 ticker 50개, 검색·정렬, 카드 그리드) | CoinGecko + Binance + Upbit |
| `/ko/crypto/gainers` | 24h 상승률 Top 50 | CoinGecko |
| `/ko/crypto/losers` | 24h 하락률 Top 50 | CoinGecko |
| `/ko/crypto/volume` | 24h 거래대금 Top 50 | CoinGecko |
| `/ko/crypto/[symbol]` | 종목 상세: 가격·24h 변동·시가총액·캔들 차트 + 거래량 + 백테스트 진입 버튼 | CoinGecko + Binance + Upbit |
| `/ko/us` | 미장 ticker 50개 (시가총액 정렬, 동일 패턴) | Twelve Data |
| `/ko/us/gainers` | day_gainers | Twelve Data |
| `/ko/us/losers` | day_losers | Twelve Data |
| `/ko/us/volume` | most_actives | Twelve Data |
| `/ko/us/[symbol]` | 미장 종목 상세 (동일 패턴) | Twelve Data |
| `/ko/backtest` | 백테스트 랩 인덱스 (전략 preset 카드 + "새 전략" 버튼) | localStorage |
| `/ko/backtest/new` | 전략 선택 + 종목 + 기간 + 파라미터 + 실행 → 결과 차트 + 지표 | Candle API + 엔진 |
| `/ko/settings` | 테마 · 다크모드 · 컬러 시맨틱 · 갱신 텀 · 데이터 출처 안내 · 초기화 | localStorage |
| `/ko/search?q=...` | 자산군 통합 검색 (코인 + 미장) | 자산 마스터 인덱스 |
| `/ko/not-found` | 404 친절 안내 | — |
| `/ko/crypto/news`, `/ko/us/news` | Phase 2 stub ("준비 중") | — |
| `/ko/kr/**` | Phase 1.5 stub | — |
| `/ko/backtest/saved` | Phase 1.1 (1차 출시 직후 추가) | localStorage |

**모든 페이지 공통:**
- 상단 헤더(로고 + 검색 + Settings + 햄버거)
- 좌측 사이드바 (lg+)
- 푸터(데이터 출처 + 면책 + 깃허브 링크 - 옵션)
- breadcrumb (자산군 그룹 → 페이지)
- canonical · OG · JSON-LD (자산 페이지는 `FinancialProduct`)

**Definition of Done (1차 출시):**
1. 모든 활성 라우트 200 응답 (sitemap 포함)
2. 종목 상세 페이지에서 5년+ 일봉 historical 받아짐
3. 백테스트 buy-and-hold / SMA crossover / RSI 3 preset 모두 실행 → 결과 표시
4. 다크/라이트 + 컬러 시맨틱 토글 전환 시 차트 색 즉시 갱신
5. lighthouse 모바일 점수 80+ (Performance / SEO / Accessibility)
6. 종목 상세 페이지 초기 JS payload 250KB gzip 이하
7. 면책 + 데이터 출처 표기 모든 페이지 노출
8. 검색이 코인 + 미장 자산 1000+ 종목 인덱스에서 substring + Cmd+K로 동작

## 결과

### 긍정적
- 핵심 가치(시세 + 랭킹 + 차트 + 백테스트) 모두 포함.
- 작업량 통제 (1차 4주 추정).
- Phase 1.5 / Phase 2 진입 경로 명확.

### 부정적
- `/backtest/saved` 누락 — 사용자가 첫 결과 저장 못함. → 완화: Phase 1.1로 1주 내 추가.
- 국내·뉴스 stub 페이지의 시각 잡음. → 완화: 깔끔한 "준비 중" 카드.

### 따라오는 작업
- 라우트 셸 부트 (위 표 기반)
- `app/[locale]/sitemap.ts` (활성 라우트만)
- `app/[locale]/robots.ts`
- 페이지별 `generateMetadata`
- 자산 상세 페이지 JSON-LD

## 참고

- ADR-0001 (스코프), ADR-0014 (메뉴)
- yutils `app/[locale]/page.tsx` (대시보드 패턴 차용 가능)
