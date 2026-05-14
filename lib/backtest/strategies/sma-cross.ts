import type {IndicatorRow} from "@/lib/types";
import type {Strategy, IndicatorField} from "../types";

// ADR-0020 Preset 2 — SMA Crossover.
// fast > slow 골든크로스 → buy, fast < slow 데드크로스 → sell.
// D1 사전계산 컬럼 (sma_5/20/50/100/200) 과 매칭되면 indicators 우선 사용,
// 매칭 안 되는 사용자 파라미터는 streaming SMA 자체 계산.

const PRECOMPUTED_SMA = new Set([5, 20, 50, 100, 200]);

type SmaCrossState = {
  fast: number;
  slow: number;
  closes: number[];
  prevSign: -1 | 0 | 1;
};

function smaAt(closes: number[], period: number): number | undefined {
  if (closes.length < period) return undefined;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

function indicatorValue(
  row: IndicatorRow | undefined,
  period: number
): number | undefined {
  if (!row || !PRECOMPUTED_SMA.has(period)) return undefined;
  return row[`sma_${period}` as keyof IndicatorRow] as number | undefined;
}

export const smaCross: Strategy<SmaCrossState> = {
  id: "sma-cross",
  name: "SMA Crossover",
  nameKo: "이동평균 교차",
  description:
    "Buy on fast SMA crossing above slow SMA (golden cross); sell on death cross.",
  descriptionKo:
    "단기 이동평균이 장기를 상향 돌파(골든크로스) 시 매수, 하향 돌파(데드크로스) 시 매도.",
  params: [
    {
      key: "fast",
      label: "Fast period",
      labelKo: "단기 기간",
      type: "int",
      min: 2,
      max: 200,
      default: 20,
    },
    {
      key: "slow",
      label: "Slow period",
      labelKo: "장기 기간",
      type: "int",
      min: 5,
      max: 400,
      default: 50,
    },
  ],
  requiredIndicators(params): IndicatorField[] {
    const fields: IndicatorField[] = [];
    if (PRECOMPUTED_SMA.has(params.fast)) {
      fields.push(`sma_${params.fast}` as IndicatorField);
    }
    if (PRECOMPUTED_SMA.has(params.slow)) {
      fields.push(`sma_${params.slow}` as IndicatorField);
    }
    return fields;
  },
  validateParams(params) {
    if (!Number.isInteger(params.fast) || !Number.isInteger(params.slow)) {
      return "fast and slow must be integers";
    }
    if (params.fast >= params.slow) return "fast must be less than slow";
    if (params.fast < 2 || params.slow > 400) return "out of range";
    return null;
  },
  init: (params) => ({
    fast: params.fast,
    slow: params.slow,
    closes: [],
    prevSign: 0,
  }),
  onBar: (candle, indicators, state, position) => {
    state.closes.push(candle.c);

    const fastVal =
      indicatorValue(indicators, state.fast) ?? smaAt(state.closes, state.fast);
    const slowVal =
      indicatorValue(indicators, state.slow) ?? smaAt(state.closes, state.slow);

    if (fastVal === undefined || slowVal === undefined) {
      return "hold";
    }

    const sign: -1 | 0 | 1 =
      fastVal > slowVal ? 1 : fastVal < slowVal ? -1 : 0;
    const prevSign = state.prevSign;
    state.prevSign = sign;

    // 첫 비교 (prevSign=0) 는 신호 안 냄 — 추세 시작인지 알 수 없음.
    if (prevSign === 0) return "hold";

    // 골든크로스
    if (sign === 1 && prevSign !== 1 && position === 0) return "buy";
    // 데드크로스
    if (sign === -1 && prevSign !== -1 && position === 1) return "sell";

    return "hold";
  },
};
