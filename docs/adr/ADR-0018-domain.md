# ADR-0018: 도메인 · 브랜딩

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 도메인 최종 확정: 2026-05-15 (`trading.jdgrid.com`)
- 결정자: lab-trading 메인테이너
- 관련 ADR: ADR-0003 (CF 호스팅)

## 컨텍스트

`wrangler.jsonc`의 `name`은 결정됐다 (`lab-trading`). production 도메인은 미정. yutils는 `krutils.com` 도메인에 `devtools.krutils.com` 서브로 운영. lab-trading은 사용자 보유 다른 도메인 (`jdgrid.com`) 활용 가능.

## 검토한 옵션

### A. 새 도메인 등록 (예: `lab-trading.app`, `labtrading.io`)
- 장점: 정체성 명확. 별도 브랜드.
- 단점: 등록비 + 갱신비 ($10-50/year).

### B-1. `krutils.com` 서브도메인 (`trading.krutils.com`)
- 장점: yutils와 같은 보호자 도메인.
- 단점: yutils와 브랜드 결합. 분리 매각·재배포 어려움.

### B-2. `jdgrid.com` 서브도메인 (`trading.jdgrid.com`) ⭐
- 장점: 사용자 별도 보유 도메인 — yutils와 브랜드 분리 자연. 도메인 등록비 0.
- 단점: yutils 자매 인지가 명시적 도메인 매핑으로는 약함 (UI/푸터에서 자매 링크로 보강).

### C. CF Workers 기본 서브 (`lab-trading.<account>.workers.dev`)
- 장점: 비용 0. 즉시 사용.
- 단점: 보기 안 좋음 (`workers.dev` 도메인은 신뢰감 ↓). SEO 약함.

### D. 한국어 도메인 (예: `lab트레이딩.kr`, `랩트레이딩.com`)
- 장점: 한국어 사용자 인지.
- 단점: 영어 URL 공유·복사 어려움. 검색 친화 ↓.

## 결정

**옵션 B-2 채택 — `trading.jdgrid.com` 으로 확정 (2026-05-15).**

근거:
1. 사용자가 `jdgrid.com` 도메인 별도 보유 — 1차 출시 비용 0.
2. **yutils 와 브랜드 분리** — `krutils.com` 서브가 아닌 별도 부모 도메인이라 lab-trading 이 독립 자산으로 성립. 추후 매각·재배포·rebrand 시 유리.
3. 추후 별도 도메인 (예: `labtrading.io`) 으로 마이그레이션 시점도 자유롭게 결정 가능 (CF DNS 만 변경).
4. yutils 와의 자매 사이트 관계는 푸터/검색/메타에 명시 (도메인 매핑이 아닌 콘텐츠 측에서).

**최종 잠금 (2026-05-15):**
- Production URL: **`https://trading.jdgrid.com`**
- 환경 변수: `NEXT_PUBLIC_SITE_URL=https://trading.jdgrid.com`
- CF Workers Custom Domain 또는 Routes 로 연결

**브랜딩:**
- 사이트 이름: **lab-trading** (소문자 유지, yutils 와 일관된 톤)
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
- yutils 와 브랜드 분리 — lab-trading 이 독립 자산.
- CF DNS 한 곳에서 관리 (`jdgrid.com` 존).
- 추후 marketplace / 매각·재투자 / 별도 브랜딩에 자유.

### 부정적
- yutils 와 도메인 매핑상 자매 인지가 명시적이지 않음. → 완화: 푸터 · README · OG 메타에 자매 사이트 링크 (이미 구현).
- 사용자가 두 도메인 (`krutils.com` + `jdgrid.com`) 의 DNS 두 곳을 운영. → 완화: 둘 다 CF DNS 라 관리 부담 사실상 동일.

### 따라오는 작업
- 사용자: `trading.jdgrid.com` CF DNS CNAME (또는 Custom Domain) 셋업
- `wrangler.jsonc` 또는 CF 대시보드에서 Workers 라우트 연결
- `NEXT_PUBLIC_SITE_URL=https://trading.jdgrid.com` 환경변수 등록 (`.dev.vars` 로컬 + `wrangler.jsonc` vars 또는 `wrangler secret put` 프로덕션)
- 파비콘 1차 (default 또는 단순 텍스트) + 추후 디자인

## 변경 이력

| 날짜 | 변경 | 사유 |
|---|---|---|
| 2026-05-12 | 옵션 B (`krutils.com` 서브) 권장안으로 초안 작성 | yutils 자매 인지 |
| 2026-05-14 | DECISIONS.md Q13 일괄 권장 동의로 옵션 B Accepted | — |
| 2026-05-15 | 옵션 B-2 (`trading.jdgrid.com`) 로 최종 확정 — `krutils.com` 서브 → `jdgrid.com` 서브 | 사용자가 별도 부모 도메인 보유, yutils 와 브랜드 분리가 추후 자산 가치에 유리 |

## 참고

- yutils `wrangler.jsonc` + production 도메인 패턴 (`devtools.krutils.com`)
