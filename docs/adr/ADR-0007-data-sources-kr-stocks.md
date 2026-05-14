# ADR-0007: 국내 주식 데이터 소스

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요 — 법적 위험 포함)
- 관련 ADR: ADR-0001 (스코프 — Phase 1.5), ADR-0009 (캐싱)

## 컨텍스트

국내(KOSPI · KOSDAQ) 시세·랭킹·OHLCV·공시·종목 마스터를 제공해야 한다. 조사 결과 한국 주식은 **법적·계약적 위험**이 다른 자산군보다 크다:

- 네이버 금융, 다음 금융 unofficial endpoint는 ToS상 무단 자동수집·재배포 금지. **lab-trading은 공개 commercial 사이트라 운영 의존 시 ToS 위반 직격탄**.
- KRX는 pykrx 같은 unofficial 호출을 실제로 차단 조치 중 (로그인 필수화 등). 의존 시 언제든 깨질 수 있음.

공식·합법 소스 후보:

| 소스 | 한도 | 인증 | 강점 | 약점 |
|---|---|---|---|---|
| **KIS Open API** (한국투자증권) | 10 req/s (개인), 일일 한도 없음 | OAuth + **실계좌/모의계좌 필수** | 실시간 시세·OHLCV·랭킹·외인기관·재무 풍부, REST/JSON | 계좌 개설 진입장벽 |
| **KRX OPEN API** | 키당 10K/day | API Key | 공식, 일별 종마감 데이터 안정 | 실시간 없음 |
| **공공데이터포털 — 금융위 주식시세정보** | 10K/day (자동승인) | data.go.kr 키 | 법적 안전성 최고, 일봉 OHLCV | 응답 2-5초, JSON 스키마 거침 |
| **OpenDART** | 20K/day | API Key | 공시·재무제표 원본 | 시세 아님 |
| **키움 REST API** | 미공개 (재확인) | OAuth + 키움 계좌 | KIS 대체재 | 문서·예제 KIS 대비 부족 |
| **LS증권 REST API** | 미공개 | OAuth + LS 계좌 | KIS 대체재 | 동일 |
| **네이버 m.stock.naver.com** | 없음 | 없음 | 즉시 가능, 풍부 | **ToS 위반 위험 큼** |
| **pykrx 백엔드** | 없음 | 없음 | KRX 직접 | **KRX가 차단 진행 중** |

## 검토한 옵션

### A. KIS Open API + KRX OPEN API + 공공데이터포털 + OpenDART (조사 권장 Pattern A)
- 장점: **모든 소스가 공식 + 법적 안전 + CF Workers fetch 호환**. KIS 토큰 캐시 패턴이 정착되면 다중 사용자 fan-in으로 10 req/s 한도 사실상 문제 없음. OpenDART 20K/day는 공시 SSG 풍부.
- 단점: **KIS는 실계좌 또는 모의계좌 개설이 필요**(비대면 가능). 사용자의 한국투자증권 계좌 1개로 lab-trading 운영 키를 발급받아야 한다. 어댑터 3-4개 운영.

### B. 네이버 m.stock.naver.com unofficial 단독 (조사 권장 Pattern B — 프로토타입 한정)
- 장점: 즉시 시작 가능. 데이터 풍부.
- 단점: **상업 운영 시 ToS 위반**. IP 차단 가능성. 분쟁 위험. **공개 도메인 런칭 금지**라고 조사 결과가 명시.

### C. Phase 1.5 자체를 포기 — lab-trading은 코인+해외만
- 장점: 법적 리스크 0. 1차 출시 작업량 ↓.
- 단점: 한국어 사용자 대상 사이트가 코스피·코스닥을 빼면 핵심 가치 절반 누락.

### D. KIS + 공공데이터포털 + OpenDART (KRX OPEN API 제외)
- 장점: 어댑터 3개로 정리. KRX 일별 데이터는 공공데이터포털이 대체 가능.
- 단점: KRX OPEN API의 일별 시세는 공공데이터포털보다 응답 빠름.

### E. KIS 단독
- 장점: 가장 단순.
- 단점: KIS만으로 모든 데이터 커버는 어려움. 공시·재무는 OpenDART가 더 풍부.

## 결정

**옵션 A 채택 권장 (Phase 1.5 도입 시점에 일괄 활성화).**

단, **Phase 1.5 진행 전제조건은 사용자의 KIS 키 발급**. 사용자가 한국투자증권 계좌(비대면 개설 가능) + 모의투자 가입을 완료해야 어댑터 활성화 가능.

근거:
1. 네이버/다음 unofficial은 공개 commercial 사이트에서 운영 위험이 너무 크다 (조사 결과가 명시적으로 "공개 도메인 런칭 금지" 권고).
2. 4개 공식 소스를 조합하면 1차 출시 데이터 풍부함 측면에서 부족함 없음.
3. **KIS 진입장벽이 있지만 한 번만 넘으면** 운영 안정성·데이터 정확성이 unofficial보다 훨씬 좋다.
4. 시세는 KIS, 일별 백테스트 데이터는 공공데이터포털, 공시는 OpenDART, KRX OPEN API는 백업·검증용으로 역할 분리.

**잠금 항목 (Phase 1.5):**

| 어댑터 | 키 | 용도 | 캐시 TTL |
|---|---|---|---|
| `lib/adapters/kis.ts` | `KIS_APP_KEY` + `KIS_APP_SECRET` (OAuth 토큰 23h) | 실시간 시세·OHLCV·랭킹·외국인/기관 매매동향 | 30s (시세), 5min (랭킹), 1h (일봉) |
| `lib/adapters/krx-openapi.ts` | `KRX_API_KEY` | 일별 종마감·종목 마스터·공매도·ESG (백업·검증) | 24h (일별), 7day (마스터) |
| `lib/adapters/data-go-kr.ts` | `DATA_GO_KR_KEY` | 일봉 OHLCV historical (백테스트 데이터 메인) | 24h (일봉) |
| `lib/adapters/opendart.ts` | `OPENDART_API_KEY` | 공시·재무제표 (종목 상세 페이지 보강) | 6h (최신 공시), 7day (재무) |

**KIS OAuth 토큰 관리:** Workers KV에 단일 키로 fan-in. 사용자 요청마다 토큰 발급 X. 23시간 TTL로 백그라운드 갱신.

**제외 (운영 의존 금지):**
- 네이버 m.stock.naver.com
- 다음 finance.daum.net
- pykrx 백엔드 호출
- 키움/LS는 Phase 2 옵션 (KIS 한도 압박 시 백업)

## 결과

### 긍정적
- 법적·계약적 위험 0. lab-trading이 어느 매체보다 안전한 한국 주식 정보 사이트가 됨.
- KIS 데이터는 거래소 정확. 분쟁 가능성 0.
- 4개 어댑터가 각자 역할 분리 → 한 소스 다운되어도 다른 소스로 폴백 가능.

### 부정적
- **KIS 계좌 개설 진입장벽** — Phase 1.5 진행이 사용자 계좌 발급에 의존. → 완화: Phase 1 출시는 KIS 없이 코인+해외만으로 진행. Phase 1.5는 사용자 발급 완료 시점에 시작.
- 어댑터 4개 운영 복잡도. → 완화: ADR-0010의 `DataAdapter` 인터페이스 통일.
- 키 관리 4개. → 완화: 모두 Workers Secrets에 일괄 등록 (1회).
- 공공데이터포털 응답 느림 (2-5초). → 완화: 24h 캐시 + KV에 사전 페치 (cron 트리거).

### 따라오는 작업
- 사용자: KIS 비대면 계좌 개설 + 모의투자 가입 + AppKey/Secret 발급 (https://apiportal.koreainvestment.com/intro)
- 사용자: KRX OPEN API 가입 + 키 발급 (https://openapi.krx.co.kr/)
- 사용자: 공공데이터포털 가입 + 금융위 주식시세정보 API 신청 (자동승인)
- 사용자: OpenDART 가입 + 키 발급 (https://opendart.fss.or.kr/)
- 위 모든 키를 `wrangler secret put`으로 등록 (Phase 1.5 진행 시점)
- 어댑터 4개 구현
- 출처 표기: "Data: 한국투자증권 · 한국거래소 · 공공데이터포털 · 금감원 DART" (ADR-0017)

## 참고

- background agent 조사 결과 (`af93c33a51e98f80f`)
- [KIS Developers](https://apiportal.koreainvestment.com/intro)
- [KRX OPEN API](https://openapi.krx.co.kr/)
- [공공데이터포털 — 금융위 주식시세정보](https://www.data.go.kr/data/15094808/openapi.do)
- [OpenDART](https://opendart.fss.or.kr/)
- [pykrx Issue #244 — KRX 차단 사례](https://github.com/sharebook-kr/pykrx/issues/244)
