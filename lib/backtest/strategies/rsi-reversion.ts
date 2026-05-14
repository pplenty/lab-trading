import type {IndicatorRow} from "@/lib/types";
import type {IndicatorField, Strategy} from "../types";

// ADR-0020 Preset 3 — RSI Reversion.
// RSI < oversold → 매수, RSI > overbought → 매도.
// D1 사전계산은 rsi_14 만. 사용자 파라미터가 다르면 streaming 자체 계산 (Wilder smoothing).

const PRECOMPUTED_RSI_PERIODS = new Set([14]);

type RsiState = {
  period: number;
  oversold: number;
  overbought: number;
  closes: number[];
  /** Wilder smoothing 의 누적 평균. period 봉 이후부터 의미. */
  avgGain: number;
  avgLoss: number;
  /** seed 가 끝났는지 (period+1 봉 이후 true). */
  seeded: boolean;
};

function indicatorRsi(
  row: IndicatorRow | undefined,
  period: number
): number | undefined {
  if (!row || !PRECOMPUTED_RSI_PERIODS.has(period)) return undefined;
  return row[`rsi_${period}` as keyof IndicatorRow] as number | undefined;
}

function streamingRsi(state: RsiState): number | undefined {
  const n = state.closes.length;
  if (n <= state.period) return undefined;

  if (!state.seeded) {
    // 첫 period 봉의 gain/loss 누적 후 단순 평균으로 시드.
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= state.period; i++) {
      const delta = state.closes[i] - state.closes[i - 1];
      if (delta > 0) gainSum += delta;
      else lossSum -= delta;
    }
    state.avgGain = gainSum / state.period;
    state.avgLoss = lossSum / state.period;
    state.seeded = true;
  } else {
    const delta = state.closes[n - 1] - state.closes[n - 2];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    state.avgGain = (state.avgGain * (state.period - 1) + gain) / state.period;
    state.avgLoss = (state.avgLoss * (state.period - 1) + loss) / state.period;
  }

  if (state.avgLoss === 0) return 100;
  const rs = state.avgGain / state.avgLoss;
  return 100 - 100 / (1 + rs);
}

export const rsiReversion: Strategy<RsiState> = {
  id: "rsi-reversion",
  name: "RSI Reversion",
  nameKo: "RSI 역추세",
  description:
    "Buy when RSI drops below oversold threshold; sell when it climbs above overbought.",
  descriptionKo:
    "RSI 가 과매도 임계를 하향 돌파 시 매수, 과매수 임계를 상향 돌파 시 매도.",
  params: [
    {
      key: "period",
      label: "RSI period",
      labelKo: "RSI 기간",
      type: "int",
      min: 2,
      max: 60,
      default: 14,
    },
    {
      key: "oversold",
      label: "Oversold threshold",
      labelKo: "과매도 임계",
      type: "int",
      min: 5,
      max: 45,
      default: 30,
    },
    {
      key: "overbought",
      label: "Overbought threshold",
      labelKo: "과매수 임계",
      type: "int",
      min: 55,
      max: 95,
      default: 70,
    },
  ],
  requiredIndicators(params): IndicatorField[] {
    if (PRECOMPUTED_RSI_PERIODS.has(params.period)) {
      return [`rsi_${params.period}` as IndicatorField];
    }
    return [];
  },
  validateParams(params) {
    if (
      !Number.isInteger(params.period) ||
      !Number.isInteger(params.oversold) ||
      !Number.isInteger(params.overbought)
    ) {
      return "period / oversold / overbought must be integers";
    }
    if (params.oversold >= params.overbought) {
      return "oversold must be less than overbought";
    }
    if (params.period < 2) return "period too short";
    return null;
  },
  init: (params) => ({
    period: params.period,
    oversold: params.oversold,
    overbought: params.overbought,
    closes: [],
    avgGain: 0,
    avgLoss: 0,
    seeded: false,
  }),
  onBar: (candle, indicators, state, position) => {
    state.closes.push(candle.c);

    const rsi = indicatorRsi(indicators, state.period) ?? streamingRsi(state);
    if (rsi === undefined) return "hold";

    if (rsi < state.oversold && position === 0) return "buy";
    if (rsi > state.overbought && position === 1) return "sell";
    return "hold";
  },
};
