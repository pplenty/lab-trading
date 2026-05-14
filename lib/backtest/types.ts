import type {Candle, IndicatorRow} from "@/lib/types";

// ADR-0019/0020 의 백테스트 공통 타입 정의.
// run.ts · strategies · metrics 가 공유하는 인터페이스를 한 곳에 모아 순환 import 회피.

export type AssetClass = "crypto" | "us" | "kr";

export type FillModel = "next-open" | "same-close";

export interface BacktestConfig {
  symbol: string;
  class: AssetClass;
  candles: Candle[];
  /** ADR-0021 D1 사전계산 지표. candles 와 1:1. 없으면 전략이 즉석 계산. */
  indicators?: IndicatorRow[];
  strategyId: string;
  params: Record<string, number>;
  initialCapital: number;
  /** 수수료. 0.001 = 0.1%. 매수·매도 양쪽에 적용. */
  feePct: number;
  /** 슬리피지. 0.0005 = 0.05%. 매수 시 가격 ↑ / 매도 시 가격 ↓ (사용자 불리). */
  slippagePct: number;
  /** KR 거래세 (매도 시만). 0.0018 = 0.18%. */
  taxPctOnSell?: number;
  fillModel: FillModel;
  /** 백테스트 시작 시각 (unix sec). 미지정 시 candles[0].t. */
  startDate?: number;
  endDate?: number;
}

export interface Trade {
  side: "buy" | "sell";
  /** 체결 시각 (unix sec). */
  t: number;
  /** 체결가 (슬리피지 반영). */
  price: number;
  /** 체결 수량 (shares / coins). */
  size: number;
  /** 체결 후 현금. */
  cash: number;
  /** 체결 후 자산가치 (cash + size × price). */
  equity: number;
}

export interface EquityPoint {
  t: number;
  v: number;
}

export interface BacktestMetrics {
  totalReturnPct: number;
  cagrPct: number;
  mddPct: number;
  sharpe: number;
  sortino: number;
  winRatePct: number;
  tradeCount: number;
  avgHoldDays: number;
}

export interface BacktestResult {
  trades: Trade[];
  /** 자산가치 추이 — candles 와 1:1. 매 봉 종가 기준 mark-to-market. */
  equityCurve: EquityPoint[];
  /** 비교 baseline — 첫 봉 시가에 매수 후 끝까지 보유. */
  buyHoldCurve: EquityPoint[];
  metrics: BacktestMetrics;
}

/** 전략 onBar 결과. `hold` 는 신호 없음. */
export type Signal = "buy" | "sell" | "hold";

export type Position = 0 | 1;

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

/** ADR-0021 indicators 컬럼 식별자 — Strategy 가 D1 어떤 컬럼에 의존하는지 표명. */
export type IndicatorField = keyof IndicatorRow;

/** state 는 전략 내부 구현 자유. 엔진은 봉마다 같은 객체를 들고 다닐 뿐. */
export interface Strategy<S = unknown> {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  params: StrategyParam[];
  /** 사용자 정의 파라미터가 D1 사전계산 셋을 벗어나는지 표명. */
  requiredIndicators(params: Record<string, number>): IndicatorField[];
  validateParams?(params: Record<string, number>): string | null;
  init(params: Record<string, number>): S;
  onBar(
    candle: Candle,
    indicators: IndicatorRow | undefined,
    state: S,
    position: Position
  ): Signal;
}
