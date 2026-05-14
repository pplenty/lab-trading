# ADR-0020: 백테스트 전략 표현 방식

- 상태: Accepted
- 날짜: 2026-05-12 (2026-05-13 ADR-0021 정합 갱신)
- 결정 확정: 2026-05-14 (DECISIONS.md Q1-Q16 일괄 권장 동의)
- 결정자: lab-trading 메인테이너 (사용자 결정 필요)
- 관련 ADR: ADR-0019 (엔진), ADR-0016 (저장), ADR-0021 (지표 사전계산)

## 컨텍스트

사용자가 전략을 어떻게 표현·저장·실행할지 결정. 옵션은 자유도와 안전성의 트레이드오프:

1. **Preset 카드** — 코드 작성 없이 폼에서 파라미터 입력 (SMA 짧은선, 긴선, 진입 조건 ...)
2. **JSON DSL** — `{when: "sma(20) > sma(50)", action: "buy"}` 같은 구조
3. **JavaScript 표현식** — 사용자가 함수 작성, `eval`/Worker eval
4. **블록 코딩 UI** — drag-drop 룰 빌더
5. **Python-like 노트북** — 클라이언트에서 mini interpreter

## 검토한 옵션

### A. Preset 카드만 (1차)
- 장점: 사용자 학습 비용 최소. 안전 (eval 없음).
- 단점: 자유도 낮음. 파워 유저는 답답.

### B. Preset 카드 + JSON DSL
- 장점: 자유도 + 안전성. JSON은 저장·공유·검증 쉬움.
- 단점: DSL 학습 곡선. 표현력 한계.

### C. JavaScript 함수 (Web Worker `eval`)
- 장점: 자유도 최대.
- 단점: 보안 위험 (다른 사용자 코드 받지 않더라도 패턴 자체가 위험). 디버그 어려움. 무한 루프 방지 필요.

### D. 블록 코딩 UI
- 장점: 시각적, 학습 곡선 ↓.
- 단점: 1차 출시 작업량 폭발.

## 결정

**옵션 A 채택 (1차), 옵션 B는 Phase 2 후보.**

근거:
1. 1차 출시 사용자 학습 곡선 최소화.
2. 보안 위험 0 (사용자 코드 실행 없음).
3. Preset 3종으로 백테스트 가치 명제(룰 기반 자동매매 시뮬)를 충분히 보여줄 수 있음.
4. 사용자가 자유도를 원하면 Phase 2에 JSON DSL 또는 함수 사용자 정의 검토.

**1차 출시 Preset (3종):**

### Preset 1 — Buy and Hold
- 파라미터: 없음
- 룰: 시작 시점 100% 매수, 끝까지 유지
- 용도: 모든 전략의 비교 기준 (buyHoldCurve가 모든 결과에 자동 포함, ADR-0019)
- ID: `buy-and-hold`

### Preset 2 — SMA Crossover (이동평균 교차)
- 파라미터: `fast` (기본 20), `slow` (기본 50)
- 룰:
  - `SMA(fast)` > `SMA(slow)`로 골든크로스 → 매수 신호
  - `SMA(fast)` < `SMA(slow)`로 데드크로스 → 매도 신호
  - 다음 봉 시가 체결
- 옵션: `fast`, `slow` 정수 (5-200), 단 `fast < slow`
- ID: `sma-cross`

### Preset 3 — RSI 역추세
- 파라미터: `period` (기본 14), `oversold` (기본 30), `overbought` (기본 70)
- 룰:
  - `RSI(period) < oversold` → 매수 신호
  - `RSI(period) > overbought` → 매도 신호
  - 다음 봉 시가 체결
- ID: `rsi-reversion`

**Phase 2 Preset 후보:**
- MACD crossover
- Bollinger Bands (mean reversion)
- Dual MA + Trailing Stop
- Donchian Channel breakout

**전략 정의 구조** (`lib/backtest/strategies/*.ts`):

```ts
import type {Candle, IndicatorRow} from "@/lib/types";

export interface StrategyParam {
  key: string;
  label: string;
  labelKo: string;
  type: "int" | "float";
  min: number;
  max: number;
  default: number;
  step?: number;
}

export interface Strategy {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  params: StrategyParam[];
  // ADR-0021 — 이 전략이 D1 indicators 어떤 컬럼에 의존하는지. 사용자 정의 파라미터가
  // 사전계산 셋(SMA 5/20/50/100/200 등)을 벗어나면 클라이언트 즉석 계산으로 fallback.
  requiredIndicators(params: Record<string, number>): IndicatorField[];
  validateParams?(params: Record<string, number>): string | null;
  init(params: Record<string, number>): unknown;
  // indicators[i]는 candles[i]와 1:1. 사전계산이 없는 (custom param) 경우 undefined → 전략이 직접 계산.
  onBar(candle: Candle, indicators: IndicatorRow | undefined, state: any, position: 0 | 1): "buy" | "sell" | "hold";
}
```

`onBar`는 각 일봉에 대해 호출. `indicators`는 D1에서 받아온 사전계산 값(ADR-0021). 사용자 파라미터가 사전계산 셋을 벗어나면 `undefined`라 전략이 자체 indicators 계산 (메모리). preset 3종은 디폴트 파라미터로 호출 시 D1 사전계산 컬럼과 100% 매핑.

**Preset의 D1 indicators 매핑:**
| Preset | 디폴트 파라미터 | 필요 indicator 컬럼 |
|---|---|---|
| buy-and-hold | — | 없음 |
| sma-cross | fast=20, slow=50 | `sma_20`, `sma_50` (사전계산) |
| sma-cross (사용자 변경, fast=10) | fast=10, slow=50 | `sma_10` (없음 → 즉석 계산), `sma_50` |
| rsi-reversion | period=14 | `rsi_14` (사전계산) |
| rsi-reversion (사용자 변경, period=9) | period=9 | `rsi_9` (없음 → 즉석 계산) |

**저장 형식 (`localStorage`):**

```ts
interface SavedStrategy {
  id: string;                  // ULID
  strategyId: string;          // preset ID
  name: string;                // 사용자 정의 이름
  params: Record<string, number>;
  defaultSymbol?: string;      // 마지막 사용 종목
  defaultClass?: AssetClass;
  createdAt: string;
  updatedAt: string;
}
```

`/backtest/saved` 페이지에 카드 그리드. 클릭 시 `/backtest/new?strategy=<id>` (사용자 저장)로 prefill.

**파라미터 폼:**
- preset 메타에 기반해 자동 생성 (`StrategyParam[]`)
- 슬라이더 + 숫자 입력
- 변경 즉시 미리보기 (debounced 300ms)

## 결과

### 긍정적
- 사용자 학습 곡선 거의 0.
- 보안 위험 0.
- 결과의 신뢰성 높음 (preset 검증 쉬움).
- Phase 2 DSL 도입 시 preset 정의 그대로 → 마이그레이션 매끄러움.

### 부정적
- 파워 유저 자유도 ↓. → 완화: Phase 2 JSON DSL 또는 함수 사용자 정의.
- Preset 3종으론 다양한 전략 표현 한계. → 완화: Preset 추가는 PR 1개로 가능 (인터페이스 정의 분명).

### 따라오는 작업
- `lib/backtest/strategies/buy-and-hold.ts`
- `lib/backtest/strategies/sma-cross.ts`
- `lib/backtest/strategies/rsi.ts`
- `lib/backtest/strategies/registry.ts` — 전체 카탈로그
- `components/panels/BacktestForm.tsx` — 자동 폼
- `components/panels/BacktestResultCard.tsx` — 결과 + 차트
- `/backtest/saved` — localStorage CRUD
- Phase 2: JSON DSL 인터프리터 ADR

## 참고

- ADR-0019 (엔진)
- Indicator definitions: SMA, RSI 공식 (직접 구현, `lib/backtest/indicators.ts`)
