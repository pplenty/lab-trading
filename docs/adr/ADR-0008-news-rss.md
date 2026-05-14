# ADR-0008: 뉴스 / RSS 큐레이션

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0001 (스코프 — Phase 2), ADR-0017 (출처)

## 컨텍스트

사용자가 "RSS 뉴스" 메뉴를 명시. 한국 금융 뉴스를 RSS로 큐레이션해서 자산군별 뉴스 페이지에 노출한다 (`/crypto/news`, `/us/news`, `/kr/news`). 단, 뉴스는 ADR-0001에서 Phase 2로 분류 (1차 출시에는 메뉴만 stub).

조사 결과 1군 RSS:

| 매체 | RSS | 카테고리 | 상업 |
|---|---|---|---|
| 한국경제 | `rss.hankyung.com/economy.xml`, `/stock.xml`, `/industry.xml` | 경제/증권/산업 | 헤드+요약+링크 OK |
| 매일경제 | `file.mk.co.kr/news/rss/rss_30000001.xml`, `rss_50200011.xml` | 헤드/증권 | OK |
| 파이낸셜뉴스 | `fnnews.com/rss/fn_realnews_stock.xml`, `_finance.xml` | 증권/금융 | OK |
| 헤럴드경제 | `biz.heraldm.com/rss/010100000000.xml` | 경제·증권 | OK |
| 조선비즈 | `biz.chosun.com/site/data/rss/news.xml` | 시장·정책 | OK |
| **Investing.com 한국어** | `kr.investing.com/webmaster-tools/rss` | 전반 | **Fusion Media ToS 위반 위험 — 상업 사용 시 라이선스 필요** |
| **연합뉴스** | (비공개·축소 추세) | 경제 | **라이선스 필요** |
| 토큰포스트 | (RSS URL 재확인 필요) | 암호화폐 | OK |

## 검토한 옵션

### A. 한경 + 매경 + 파이낸셜뉴스 + 토큰포스트 (4개 매체)
- 장점: 모두 합법 + 헤드라인 충분 + URL 안정. 카드형 노출(제목+요약+원문 링크)로 안전.
- 단점: 토큰포스트 RSS URL 확정 필요. 4개 매체 파싱 어댑터.

### B. 매체 8개+ 광범위 수집
- 장점: 노출량 최대.
- 단점: 카드 페이지의 신호 대 잡음비 ↓. RSS 파싱·중복 제거 비용 ↑.

### C. 뉴스 메뉴 자체 제거
- 장점: 작업량 0. 법적 리스크 0.
- 단점: 사용자 요구사항 위배. "통합 정보 사이트" 정체성 약해짐.

### D. AI 요약 생성 (RSS → LLM 요약)
- 장점: 차별화.
- 단점: 1차 출시 스코프 초과. LLM 호출 비용. 원문 저작권 보호와 요약 변환의 법적 경계 모호.

## 결정

**옵션 A 채택 권장 (Phase 2 활성화).**

근거:
1. 4개 매체 + 토큰포스트로 한국어 금융 뉴스 1군 거의 다 커버.
2. 카드형 노출(제목 + 요약 1-2문장 + 원문 링크 + 출처 표기)이 한국 뉴스 RSS 일반 관행. 전문 재게재가 아니라 분쟁 위험 낮음.
3. Investing.com·연합뉴스는 명시적 라이선스 필요 → 제외.
4. Phase 2 활성화 — 1차 출시는 메뉴 stub만(`/crypto/news` 등은 disabled 또는 "준비 중" 라벨).

**잠금 항목 (Phase 2):**

| 매체 | URL | 자산군 매핑 |
|---|---|---|
| 한국경제 stock | `https://rss.hankyung.com/feed/stock.xml` | `kr` |
| 한국경제 economy | `https://rss.hankyung.com/feed/economy.xml` | `kr` (보조) |
| 매일경제 증권 | `http://file.mk.co.kr/news/rss/rss_50200011.xml` | `kr` |
| 파이낸셜뉴스 증권 | `http://www.fnnews.com/rss/fn_realnews_stock.xml` | `kr` |
| 파이낸셜뉴스 금융 | `http://www.fnnews.com/rss/fn_realnews_finance.xml` | `us` (보조) + `kr` |
| 토큰포스트 (재확인) | TBD | `crypto` |
| (Phase 2.5) 한경 코인 카테고리 | TBD | `crypto` |

**자산군별 라우트:**
- `/crypto/news` — 코인 매체 + 한경 코인 카테고리
- `/us/news` — 미장 키워드 필터링 (제목에 "뉴욕증시", "다우", "S&P", "나스닥", 미국 기업명 등 포함)
- `/kr/news` — 한국 매체 전부

**파싱·캐시:**
- `lib/adapters/rss.ts` — `fast-xml-parser` (0-dep) 사용
- CF Workers Cron Triggers로 5분마다 KV에 정규화 저장
- 사용자 요청은 KV에서 즉시 응답
- 중복 제거 (제목 정규화 + 시간 클러스터링)

**제외:**
- Investing.com 한국어 (Fusion Media ToS 위반 위험)
- 연합뉴스 (BTL 라이선스 필요)
- 코인니스 (RSS 미공개, Telegram만)

## 결과

### 긍정적
- 4개 매체로 한국어 금융 뉴스 1군 커버.
- 모든 매체가 합법 사용 패턴 내.
- KV + cron 패턴이 미래 다른 데이터 source(예: 주요 거시지표 RSS)에도 재사용 가능.

### 부정적
- 토큰포스트·한경 코인 RSS URL 확정 필요. → 완화: Phase 2 활성화 시 운영자가 1주 전 1회 점검.
- 자산군별 필터링 정확도 (특히 us 뉴스 키워드 매칭). → 완화: 1차에 단순 키워드, Phase 2.5에 정제.
- 매체별 ToS 변경 가능성. → 완화: 운영 페이지(README 또는 별도 문서)에 매체 약관 링크 모음.

### 따라오는 작업
- 1차 출시: `/<asset>/news` 라우트는 메뉴에 노출하되 페이지는 "Phase 2 — 준비 중" stub.
- Phase 2: `lib/adapters/rss.ts` 구현 + Cron Trigger 셋업 + KV 키 설계 + 자산군별 필터 룰
- 매체별 출처 표기 카드 (ADR-0017)
- 토큰포스트·한경 코인 RSS URL 운영 직전 점검

## 참고

- background agent 조사 결과 (`af93c33a51e98f80f`)
- [한국경제 RSS](https://www.hankyung.com/feed)
- [매일경제 RSS](https://feeder.co/discover/11aec2568c/mk-co-kr)
- [파이낸셜뉴스 RSS](https://www.fnnews.com/rss)
