# ADR-0012: 상승 / 하락 컬러 시맨틱

- 상태: Accepted
- 날짜: 2026-05-12
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0011 (차트), ADR-0002 (테마 시스템)

## 컨텍스트

상승/하락을 색으로 표시하는 관행이 지역마다 정반대다:

- **한국 / 일본 / 중국 / 대만**: **빨강 = 상승, 파랑(또는 초록) = 하락**
- **미국 / 유럽**: **초록 = 상승, 빨강 = 하락**

lab-trading은 한국 사용자 + 글로벌 자산을 동시에 다루는 사이트라 디폴트와 토글 정책을 잠가야 한다. 잘못된 디폴트는 사용자에게 "위아래가 거꾸로"인 인지 부조화를 일으킨다.

## 검토한 옵션

### A. 한국식 디폴트 (빨강=상승, 파랑=하락) + 사용자 토글
- 장점: 1차 출시 타깃이 한국어 사용자. 익숙한 표기. 토스증권·키움·삼성·다음·네이버 모두 한국식.
- 단점: 코인을 글로벌 표기에 익숙한 사용자가 보면 어색.

### B. 글로벌 디폴트 (초록=상승, 빨강=하락) + 사용자 토글
- 장점: 코인 시장(Binance·Coinbase·TradingView)이 글로벌식. 미장도 글로벌식.
- 단점: 한국 주식 사용자에게 매우 어색. KOSPI 상승이 초록으로 표시되면 "내려갔나?" 착각.

### C. 자산군별 디폴트 (코인·미장은 글로벌식, KR은 한국식)
- 장점: 각 시장의 표준 따름.
- 단점: 한 화면에 두 자산군이 같이 있으면 컬러 인지 부조화. 사용자 학습 비용 ↑.

### D. 단일 컬러(예: 회색) — 변동률은 +/- 부호로만 표시
- 장점: 색 충돌 없음.
- 단점: 가독성·정보 밀도 ↓. 금융 사이트 관행과 어긋남.

## 결정

**옵션 A 채택 권장 (한국식 디폴트 + 설정에서 토글).**

근거:
1. 1차 출시 타깃이 한국어 사용자. 디폴트는 익숙함 우선.
2. 토글은 `Settings` 페이지 + 사이드바 옵션. `localStorage` 키 `lab-trading-color-semantics`: `"kr"` (디폴트) | `"global"`.
3. 자산군별 자동 전환(옵션 C)은 디자인 일관성 우선으로 거부. 한 화면 단일 시맨틱.

**잠금 항목:**

- **CSS 토큰** (`globals.css`):
  ```css
  :root {
    --color-up: #e91e2c;     /* 한국식: 상승 빨강 */
    --color-down: #1f6dff;   /* 한국식: 하락 파랑 */
  }
  :root[data-color-semantics="global"] {
    --color-up: #16a34a;     /* 글로벌식: 상승 초록 */
    --color-down: #dc2626;   /* 글로벌식: 하락 빨강 */
  }
  ```

- **inline init script** (flash 방지): `[locale]/layout.tsx`의 `<head>`에서 `localStorage["lab-trading-color-semantics"]` 읽어 `:root` data attribute 적용. 같은 패턴이 yutils ADR-0008의 theme init script.

- **컴포넌트 사용:**
  ```tsx
  <span className="text-up">+3.5%</span>     // 또는 conditional: change > 0 ? "text-up" : "text-down"
  <ChevronUp className="text-up" />
  ```

- **Tailwind 토큰 매핑** (`@theme inline`):
  ```css
  @theme inline {
    --color-up: var(--color-up);
    --color-down: var(--color-down);
  }
  ```

- **차트** (ADR-0011): lightweight-charts `applyOptions({ upColor: getComputedStyle(:root)["--color-up"], downColor: ... })`. 토글 변경 시 `applyOptions` 재호출.

- **접근성 (WCAG)**: 색만으로 의미 전달 금지 (컨벤션 I). 변동률 표시는 항상 ▲/▼ 또는 +/- 부호 병기.

**토글 진입점:**
- `Settings` 페이지에 라디오 선택 ("한국식: 빨강↑/파랑↓" / "글로벌식: 초록↑/빨강↓")
- 사이드바 옵션에 작은 토글 (옵션, Phase 2)
- 사용자 라이트 프리셋 12종 × 컬러 시맨틱 2종 = 24 조합 모두 시각 회귀 테스트

## 결과

### 긍정적
- 한국 사용자 디폴트 익숙. 코인·미장 사용자도 토글 1번으로 글로벌식 적용.
- CSS 토큰 1쌍으로 모든 컴포넌트 일관 적용.
- 접근성 (컬러+부호 병기)으로 색맹 사용자 대응.

### 부정적
- 컬러 시맨틱 × 12 라이트 프리셋 × 다크 모드 = 24 조합 회귀 매트릭스. → 완화: 색은 CSS 토큰 2개만 영향, 프리셋과 독립이라 회귀 위험 작음.
- 토글이 글로벌 상태 — 한 화면 일관성 유지하되 사용자가 매번 "어느 모드인지" 인지 부담. → 완화: 헤더에 작은 +/- 시각 인디케이터 옵션 (Phase 2).

### 따라오는 작업
- `globals.css`에 `--color-up`/`--color-down` 토큰
- `lib/themes.ts`에 `applyColorSemantics(mode: "kr" | "global")` 함수
- `components/ColorSemanticSwitcher.tsx`
- `lib/storage.ts`에 `useLocalStorageString` 활용
- inline init script에 컬러 시맨틱 추가
- `Settings` 페이지 라디오

## 참고

- yutils ADR-0008 (theme persistence)
- yutils ADR-0009 (dark mode axis)
