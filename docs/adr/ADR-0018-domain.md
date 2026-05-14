# ADR-0018: 도메인 · 브랜딩

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0003 (CF 호스팅)

## 컨텍스트

`wrangler.jsonc`의 `name`은 결정됐다 (`lab-trading`). production 도메인은 미정. yutils는 `krutils.com` 도메인에 `devtools.krutils.com` 서브로 운영. lab-trading도 사용자 기존 자산을 활용할지, 새 도메인을 등록할지.

## 검토한 옵션

### A. 새 도메인 등록 (예: `lab-trading.app`, `labtrading.io`)
- 장점: 정체성 명확. 별도 브랜드.
- 단점: 등록비 + 갱신비 ($10-50/year).

### B. `krutils.com` 서브도메인 (`trading.krutils.com`, `lab.krutils.com`)
- 장점: 도메인 등록 비용 0. yutils와 같은 보호자.
- 단점: yutils와 브랜드 결합. 분리 매각·재배포 어려움.

### C. CF Workers 기본 서브 (`lab-trading.<account>.workers.dev`)
- 장점: 비용 0. 즉시 사용.
- 단점: 보기 안 좋음 (`workers.dev` 도메인은 신뢰감 ↓). SEO 약함.

### D. 한국어 도메인 (예: `lab트레이딩.kr`, `랩트레이딩.com`)
- 장점: 한국어 사용자 인지.
- 단점: 영어 URL 공유·복사 어려움. 검색 친화 ↓.

## 결정

**옵션 B 채택 권장 (1차 출시 — `trading.krutils.com` 또는 `lab.krutils.com`).**

근거:
1. 사용자가 `krutils.com` 도메인 기존 보유 (yutils가 `devtools.krutils.com`).
2. 1차 출시 비용 0.
3. yutils와 자매 사이트 관계 명시적 — 사용자 신뢰 ↑ (yutils 사용자가 자연스럽게 인지).
4. 추후 트래픽·매각 가치 발생 시 별도 도메인으로 마이그레이션 가능 (CF DNS만 변경).

**잠금 항목 (사용자 선택):**

| 후보 도메인 | 어떻게 들리나 | 권장 |
|---|---|---|
| `trading.krutils.com` | "트레이딩 유틸" | ★★★ |
| `lab.krutils.com` | "랩" — 백테스트 강조 | ★★ |
| `markets.krutils.com` | 시장 정보 위주 | ★★ |
| `quotes.krutils.com` | 시세 위주 | ★ |
| `finance.krutils.com` | 금융 일반 | ★★ |

**제안:** `trading.krutils.com` (가장 직관적, 도메인+이름이 "lab-trading"과 자연스러움)

**브랜딩:**
- 사이트 이름: **lab-trading** (소문자 유지, yutils와 일관)
- 헤더 로고: 텍스트만, monospace 폰트 (yutils 패턴)
- 파비콘: 추후 결정 (1차 출시 직전 또는 default)
- 색: 사용자 라이트 프리셋 12종 (yutils 차용) — 단일 브랜드 컬러 강제 X
- 태그라인 (`Settings` / 푸터 / OG): "코인 · 해외주식 · 국내주식 시세와 일봉 백테스트"

**Phase 2 후보 (별도 도메인 검토 시):**
- `labtrading.io` — `.io` 가용성 확인
- `labtrading.app` — `.app`은 HTTPS 강제 ($12-16/year)
- `labtrading.kr` — 한국 국가 도메인

## 결과

### 긍정적
- 1차 출시 도메인 비용 0.
- yutils와 자매 사이트 인지.
- CF DNS 한 곳에서 관리.

### 부정적
- yutils·lab-trading 분리 매각·재브랜딩 시 도메인 마이그레이션 필요. → 완화: 1차 출시 단계에는 영향 없음.
- 서브도메인이라 "독립 사이트" 인상 약함. → 완화: 사이트 헤더·OG·SEO 메타에 "lab-trading"을 1급 브랜드로 노출.

### 따라오는 작업
- 사용자: `trading.krutils.com` CF DNS CNAME 셋업 (또는 사용자 선택 서브)
- `wrangler.jsonc` 또는 CF 대시보드에서 Workers 라우트 연결
- `NEXT_PUBLIC_SITE_URL=https://trading.krutils.com` 환경변수 등록
- 파비콘 1차 (default 또는 단순 텍스트) + 추후 디자인

## 참고

- yutils `wrangler.jsonc` + production 도메인 패턴
