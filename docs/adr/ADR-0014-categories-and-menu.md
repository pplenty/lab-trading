# ADR-0014: 카테고리 · 메뉴 구조

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0001 (스코프), ADR-0015 (출시 페이지)

## 컨텍스트

사용자 메뉴 구상: "대시보드 + 각 카테고리 (코인/해외/국내) × (시세/상승률/하락률/거래량/뉴스) + 백테스트". 사이드바 구조·URL 슬러그를 잠금한다.

## 검토한 옵션

### A. 자산군 그룹 + 자산군별 5개 하위 메뉴 (시세/gainers/losers/volume/news) + 백테스트 별도
- 장점: 사용자가 처음 그린 구조. 정보 밀도 균형. 사이드바 그룹 4개.
- 단점: 사이드바 항목 수 ↑.

### B. 자산군 그룹 + 종목 상세 안에 랭킹 진입 (사이드바엔 자산군만)
- 장점: 사이드바 간결.
- 단점: 랭킹은 별도 페이지 가치가 큰데 깊이 숨김.

### C. 그룹 없이 평면 (대시보드, 코인 시세, 코인 상승률, 미장 시세, ...)
- 장점: 단순.
- 단점: 메뉴 폭증. 자산군 일관성 떨어짐.

### D. 옵션 A + 1차 출시 시 국내·뉴스 메뉴는 disabled 라벨
- 장점: 메뉴 구조는 처음부터 완성. 사용자가 "준비 중"임을 인지.
- 단점: stub 페이지 sitemap 미포함 필요.

## 결정

**옵션 D 채택 권장.**

근거:
1. ADR-0001(스코프)에 따라 1차 출시는 코인+해외+백테스트. 국내·뉴스는 Phase 1.5 / Phase 2.
2. 메뉴 구조를 처음부터 박으면 추후 활성화 시 라우팅 변경 0.
3. Disabled 라벨로 사용자에게 "확장 로드맵"을 명시 → 신뢰감.

**잠금 구조:**

```
헤더:
  로고(lab-trading)  ·  통합 검색  ·  ⚙️ Settings  ·  햄버거(모바일)

사이드바 (lg+):

대시보드          /                          [활성]

코인              /crypto                     [활성]
  시세            /crypto                     (위와 동일, 그룹 헤더)
  상승률          /crypto/gainers             [활성]
  하락률          /crypto/losers              [활성]
  거래량          /crypto/volume              [활성]
  뉴스            /crypto/news                [Phase 2 — 비활성, "준비 중"]

해외주식          /us                         [활성]
  시세            /us
  상승률          /us/gainers                 [활성]
  하락률          /us/losers                  [활성]
  거래량          /us/volume                  [활성]
  뉴스            /us/news                    [Phase 2 — 비활성]

국내주식          /kr                         [Phase 1.5 — 비활성, "곧 출시"]
  코스피          /kr/kospi                   [Phase 1.5]
  코스닥          /kr/kosdaq                  [Phase 1.5]
  상승률          /kr/gainers                 [Phase 1.5]
  하락률          /kr/losers                  [Phase 1.5]
  거래량          /kr/volume                  [Phase 1.5]
  뉴스            /kr/news                    [Phase 2]

백테스트          /backtest                   [활성]
  새 전략         /backtest/new               [활성]
  내 전략         /backtest/saved             [활성 - localStorage 기반]

즐겨찾기 ⭐       (localStorage 기반, 0개면 hide)
최근 본 종목 🕐   (localStorage LRU 8개)
```

**자산군 그룹 헤더**: 자산군명 클릭 시 자산군 인덱스(시세 페이지)로 navigate.

**비활성(disabled) 라벨 노출:**
- 사이드바 항목 텍스트는 표시하되 회색 + "준비 중" 작은 라벨.
- 클릭 시 stub 페이지로 이동 (`<h1>준비 중입니다</h1>` + 알림 신청 옵션 — Phase 2).
- sitemap·robots noindex.

**모바일 (lg-):**
- 헤더 햄버거 → 좌측 drawer (yutils ADR-0017·0023 패턴 차용)
- drawer 닫기: ESC / 오버레이 클릭 / 링크 클릭

## 결과

### 긍정적
- 메뉴 구조가 처음부터 완성. Phase 1.5 / Phase 2 활성화는 disabled 플래그 제거만.
- 사용자가 로드맵을 한눈에 인지.
- yutils의 사이드바 부품(`ToolsSidebar`, `AppShell`, `MobileSidebarTrigger`) 그대로 차용.

### 부정적
- 메뉴 항목이 많아 사이드바 길이 ↑. → 완화: 그룹 collapse (자산군 단위), 사용자 localStorage로 유지 (yutils 패턴).
- Disabled 항목이 시각 잡음. → 완화: 라이트 회색 + "준비 중" 토큰 작게.

### 따라오는 작업
- `lib/menu.ts` — 메뉴 트리 정의 (활성/비활성 플래그 포함)
- `components/AppSidebar.tsx` (yutils의 `ToolsSidebar` 차용 + 트레이딩 메뉴로 변경)
- stub 페이지 라우트 (`app/[locale]/<class>/<subpath>/page.tsx` — disabled 라벨 + 알림 신청)
- sitemap에서 disabled 라우트 제외

## 참고

- yutils ADR-0014 (사이드바), ADR-0017 (모바일 drawer), ADR-0023 (글로벌 햄버거)
