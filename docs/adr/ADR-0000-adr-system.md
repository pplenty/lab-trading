# ADR-0000: ADR 시스템 도입

- 상태: Accepted
- 날짜: 2026-05-12
- 결정자: lab-trading 메인테이너
- 관련 ADR: —

## 컨텍스트

lab-trading은 데이터 소스 4개군(코인/해외/국내/뉴스) × 차트 × 백테스트 × CF 인프라까지 결정 표면이 넓다. 각 결정은 후속 결정에 강하게 영향을 미치며(예: 해외주식 API 선택이 캐시 전략과 컬러 시맨틱 디폴트, 백테스트 데이터 깊이에까지 파급), 결정의 "왜"를 잃으면 6개월 뒤 자기 자신이 무의미한 자리이동을 하게 된다.

자매 프로젝트 yutils가 같은 패턴으로 28개 ADR을 운영하며 효과를 검증했다. 동일한 시스템을 lab-trading에 도입한다.

## 검토한 옵션

### A. 결정 사항을 CLAUDE.md 본문에 인라인으로만 남긴다
- 장점: 파일 하나만 보면 된다.
- 단점: 결정의 이유·트레이드오프·옵션 비교가 누락된다. 결정을 뒤집을 때 이전 맥락 복구 불가.

### B. ADR 디렉토리 + 번호 + 상태 흐름 도입
- 장점: 결정마다 컨텍스트·옵션·결과를 표준 포맷으로 보존. PR 단위로 결정 리뷰 가능. 인덱스 한 장으로 의사결정 흐름 추적.
- 단점: 작성 비용. 형식 운영 부담.

### C. RFC/Design Doc (장문)
- 장점: 더 깊은 설명 가능.
- 단점: 1차 출시 단계 결정엔 과한 형식. 결정 자체보다 문서 작성에 시간 소요.

## 결정

**옵션 B 채택.**

yutils에서 검증된 형식(`docs/adr/ADR-NNNN-<slug>.md` + `README.md` 인덱스 + `template.md`)을 그대로 차용한다. 1차 출시 전이라는 특수 상황 — "모든 굵직한 결정이 사용자 결정 대기 중"인 상태를 명시적으로 표현하기 위해 모든 ADR을 `Proposed`로 출발시키고, 사용자 검토 통과 시 일괄 `Accepted`로 전환하는 절차를 추가한다.

## 결과

### 긍정적
- 사용자 검토 가능한 형태로 결정 표면이 가시화된다.
- "왜 CoinGecko인가" 같은 6개월 뒤 잊혀질 맥락이 박힌다.
- 결정 뒤집기(Superseded)도 추적 가능.

### 부정적
- ADR 작성 비용. 도구 추가·페이지 점등 같은 일상 변경에 ADR을 쓰지 않도록 README에 가이드라인을 명시.

### 따라오는 작업
- `docs/adr/template.md` 생성 (완료)
- `docs/adr/README.md` 인덱스 생성 (완료)
- ADR-0001 ~ ADR-0020 초안 작성 (완료, 모두 Proposed)
- `.claude/skills/adr-new/` 스킬 추가 (yutils에서 복제, 별도 작업)

## 참고

- yutils ADR 인덱스: `/Users/yusik/IdeaProjects/yutils/docs/adr/README.md`
- yutils ADR-0000: `/Users/yusik/IdeaProjects/yutils/docs/adr/ADR-0000-adr-system.md`
