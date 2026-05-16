// 백테스트 / 차트 / D1 사전계산 (ADR-0021) 공통 지표 코어. 0 dependency, deterministic.
// 모든 함수는 입력 길이와 같은 배열을 반환. warmup 구간 (값이 부족한 앞쪽) 은 `undefined`.
// 같은 입력 → 같은 출력 보장 (computed_version 갱신 시 ADR-0021 의 재계산 트리거).
//
// 공식 출처:
//   - SMA: Σ(c, i-N+1..i) / N
//   - EMA: c × α + EMA_prev × (1-α), α = 2/(N+1). 초기 N 개의 SMA 로 시드 (TradingView 관행).
//   - RSI: Wilder's smoothing. avg_gain = (avg_gain_prev × (N-1) + gain) / N. RSI = 100 - 100/(1 + avg_gain/avg_loss).
//   - MACD: EMA(fast) - EMA(slow). signal = EMA(MACD, sigPeriod). hist = MACD - signal.
//   - Bollinger: SMA(N) ± k × σ(N) (모집단 표준편차).
//   - ATR: Wilder's smoothing of True Range. TR = max(h-l, |h-c_prev|, |l-c_prev|).

export type Series = (number | undefined)[];

/** SMA — 단순이동평균. period 미만 인덱스는 undefined. */
export function sma(values: number[], period: number): Series {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error(`sma: period must be positive integer (got ${period})`);
  }
  const out: Series = new Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** EMA — 지수이동평균. 첫 period-1 인덱스는 undefined. period-1 위치를 SMA 로 시드. */
export function ema(values: number[], period: number): Series {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error(`ema: period must be positive integer (got ${period})`);
  }
  const out: Series = new Array(values.length);
  if (values.length < period) return out;

  const alpha = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * alpha + prev * (1 - alpha);
    out[i] = prev;
  }
  return out;
}

/** RSI — Wilder's smoothing. period 까지 undefined, period 위치부터 값. */
export function rsi(values: number[], period: number = 14): Series {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error(`rsi: period must be positive integer (got ${period})`);
  }
  const out: Series = new Array(values.length);
  if (values.length <= period) return out;

  // 첫 period 봉의 gain/loss 누적 후 단순 평균으로 시드 → 그 다음부터 Wilder smoothing.
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta > 0) gainSum += delta;
    else lossSum -= delta;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = computeRsi(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = computeRsi(avgGain, avgLoss);
  }
  return out;
}

function computeRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** MACD 라인 + signal + histogram. fast=12, slow=26, signal=9 디폴트. */
export type MacdRow = {
  macd: number | undefined;
  signal: number | undefined;
  hist: number | undefined;
};

export function macd(
  values: number[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
): MacdRow[] {
  if (fast >= slow) {
    throw new Error(`macd: fast (${fast}) must be < slow (${slow})`);
  }
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: number[] = [];
  const validIdx: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f === undefined || s === undefined) {
      macdLine.push(0);
    } else {
      macdLine.push(f - s);
      validIdx.push(i);
    }
  }

  // signal 은 macdLine 의 유효 구간에서 EMA 계산 — slow 봉 이후만.
  const slowSeed = slow - 1;
  const validMacd = macdLine.slice(slowSeed);
  const signalSlice = ema(validMacd, signal);

  const out: MacdRow[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    if (i < slowSeed || emaSlow[i] === undefined) {
      out[i] = {macd: undefined, signal: undefined, hist: undefined};
      continue;
    }
    const m = macdLine[i];
    const sigIdx = i - slowSeed;
    const sig = signalSlice[sigIdx];
    out[i] = {
      macd: m,
      signal: sig,
      hist: sig === undefined ? undefined : m - sig,
    };
  }
  return out;
}

/** Bollinger Bands. period=20, k=2 (모집단 표준편차). */
export type BollingerRow = {
  upper: number | undefined;
  middle: number | undefined;
  lower: number | undefined;
};

export function bollinger(
  values: number[],
  period: number = 20,
  k: number = 2
): BollingerRow[] {
  if (period <= 0 || !Number.isInteger(period)) {
    throw new Error(`bollinger: period must be positive integer (got ${period})`);
  }
  const out: BollingerRow[] = new Array(values.length);
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out[i] = {upper: undefined, middle: undefined, lower: undefined};
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sq += d * d;
    }
    const std = Math.sqrt(sq / period);
    out[i] = {middle: mean, upper: mean + k * std, lower: mean - k * std};
  }
  return out;
}

/** ATR — Wilder's smoothing of True Range. period=14. high/low/close 배열 필요. */
export function atr(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): Series {
  if (high.length !== low.length || low.length !== close.length) {
    throw new Error("atr: high/low/close must have same length");
  }
  const n = close.length;
  const out: Series = new Array(n);
  if (n <= period) return out;

  // True Range: max(h-l, |h-c_prev|, |l-c_prev|). i=0 은 단순 (h-l).
  const tr: number[] = new Array(n);
  tr[0] = high[0] - low[0];
  for (let i = 1; i < n; i++) {
    const range = high[i] - low[i];
    const hcp = Math.abs(high[i] - close[i - 1]);
    const lcp = Math.abs(low[i] - close[i - 1]);
    tr[i] = Math.max(range, hcp, lcp);
  }

  // 첫 period 의 TR 단순 평균 → 시드, 이후 Wilder smoothing.
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** 거래량 SMA — period=20 디폴트. */
export function volumeSma(volumes: number[], period: number = 20): Series {
  return sma(volumes, period);
}

// ──────────────────────────────────────────────────────────────────────────
// 추가 indicator 모음 (Phase 2 확장)
// 모두 동일 인터페이스: Series (number | undefined)[] 반환, length = input length.

/**
 * Stochastic Oscillator. %K = (close - lowestLow_N) / (highestHigh_N - lowestLow_N) × 100.
 * %D = %K 의 SMA (smoothK).
 * 기본 period=14, smoothK=3 (slow %K) — TradingView 디폴트.
 */
export function stochastic(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14,
  smoothK: number = 3
): {k: Series; d: Series} {
  const n = close.length;
  // rawK 는 number | null — holes 없이 초기화 (sma 가 holes 만나면 NaN → D1 NULL).
  const rawK: number[] = new Array(n).fill(0);
  const rawKValid: boolean[] = new Array(n).fill(false);
  for (let i = period - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (high[j] > hh) hh = high[j];
      if (low[j] < ll) ll = low[j];
    }
    const range = hh - ll;
    rawK[i] = range === 0 ? 50 : ((close[i] - ll) / range) * 100;
    rawKValid[i] = true;
  }
  // %K (slow) = rawK 의 SMA, %D = %K 의 SMA. validity 마스크로 NULL 보존.
  const kRaw = sma(rawK, smoothK);
  const k: Series = new Array(n);
  for (let i = 0; i < n; i++) {
    if (rawKValid[i] && kRaw[i] !== undefined) k[i] = kRaw[i];
  }
  // d = k 의 SMA (k 의 validity 동일 마스크)
  const kArr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) if (k[i] !== undefined) kArr[i] = k[i]!;
  const dRaw = sma(kArr, smoothK);
  const d: Series = new Array(n);
  for (let i = 0; i < n; i++) {
    if (k[i] !== undefined && dRaw[i] !== undefined) d[i] = dRaw[i];
  }
  return {k, d};
}

/**
 * CCI (Commodity Channel Index). period=20 디폴트.
 * CCI = (TP - SMA(TP)) / (0.015 × meanDeviation(TP, period))
 * TP = (h + l + c) / 3.
 */
export function cci(
  high: number[],
  low: number[],
  close: number[],
  period: number = 20
): Series {
  const n = close.length;
  const tp: number[] = new Array(n);
  for (let i = 0; i < n; i++) tp[i] = (high[i] + low[i] + close[i]) / 3;
  const tpSma = sma(tp, period);
  const out: Series = new Array(n);
  for (let i = period - 1; i < n; i++) {
    const mean = tpSma[i];
    if (mean === undefined) continue;
    let mad = 0;
    for (let j = i - period + 1; j <= i; j++) mad += Math.abs(tp[j] - mean);
    mad /= period;
    out[i] = mad === 0 ? 0 : (tp[i] - mean) / (0.015 * mad);
  }
  return out;
}

/**
 * Williams %R. period=14. 0(과매수) ~ -100(과매도) 범위.
 * %R = (highestHigh - close) / (highestHigh - lowestLow) × -100
 */
export function williamsR(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): Series {
  const n = close.length;
  const out: Series = new Array(n);
  for (let i = period - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (high[j] > hh) hh = high[j];
      if (low[j] < ll) ll = low[j];
    }
    const range = hh - ll;
    out[i] = range === 0 ? -50 : ((hh - close[i]) / range) * -100;
  }
  return out;
}

/**
 * ADX (Average Directional Index) + DI+/DI-. Wilder smoothing.
 * period=14 디폴트. 추세 강도 측정.
 *
 * 절차:
 *   1) TR + DM+ + DM- 계산
 *   2) period 만큼 Wilder smoothing
 *   3) DI+ = 100 × smoothedDMplus / smoothedTR
 *      DI- = 100 × smoothedDMminus / smoothedTR
 *   4) DX = 100 × |DI+ - DI-| / (DI+ + DI-)
 *   5) ADX = DX 의 Wilder smoothing
 */
export function adx(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): {adx: Series; plus: Series; minus: Series} {
  const n = close.length;
  const adxOut: Series = new Array(n);
  const plusOut: Series = new Array(n);
  const minusOut: Series = new Array(n);
  if (n < period * 2) return {adx: adxOut, plus: plusOut, minus: minusOut};

  const tr: number[] = new Array(n);
  const dmPlus: number[] = new Array(n);
  const dmMinus: number[] = new Array(n);
  tr[0] = high[0] - low[0];
  dmPlus[0] = 0;
  dmMinus[0] = 0;
  for (let i = 1; i < n; i++) {
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];
    dmPlus[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    dmMinus[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    const range = high[i] - low[i];
    const hcp = Math.abs(high[i] - close[i - 1]);
    const lcp = Math.abs(low[i] - close[i - 1]);
    tr[i] = Math.max(range, hcp, lcp);
  }

  // 시드 — 1..period 합
  let trSum = 0,
    dmPlusSum = 0,
    dmMinusSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += tr[i];
    dmPlusSum += dmPlus[i];
    dmMinusSum += dmMinus[i];
  }
  // Wilder smoothing 후 DI/DX/ADX
  const dx: Series = new Array(n);
  for (let i = period + 1; i < n; i++) {
    trSum = trSum - trSum / period + tr[i];
    dmPlusSum = dmPlusSum - dmPlusSum / period + dmPlus[i];
    dmMinusSum = dmMinusSum - dmMinusSum / period + dmMinus[i];
    const diPlus = trSum === 0 ? 0 : (100 * dmPlusSum) / trSum;
    const diMinus = trSum === 0 ? 0 : (100 * dmMinusSum) / trSum;
    plusOut[i] = diPlus;
    minusOut[i] = diMinus;
    const sum = diPlus + diMinus;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(diPlus - diMinus)) / sum;
  }
  // ADX = DX 의 Wilder smoothing. 시드 = 첫 period 의 DX 평균.
  const adxStart = period * 2;
  if (n > adxStart) {
    let dxSum = 0;
    for (let i = period + 1; i <= adxStart; i++) dxSum += dx[i] ?? 0;
    let prev = dxSum / period;
    adxOut[adxStart] = prev;
    for (let i = adxStart + 1; i < n; i++) {
      prev = (prev * (period - 1) + (dx[i] ?? 0)) / period;
      adxOut[i] = prev;
    }
  }
  return {adx: adxOut, plus: plusOut, minus: minusOut};
}

/**
 * OBV (On-Balance Volume). 누적 거래량 — 종가 상승 시 +volume, 하락 시 -volume.
 * 절대값보다 trend 가 의미 — 가격과 divergence 분석용.
 */
export function obv(close: number[], volume: number[]): Series {
  const n = close.length;
  const out: Series = new Array(n);
  if (n === 0) return out;
  out[0] = 0;
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1] ?? 0;
    if (close[i] > close[i - 1]) out[i] = prev + volume[i];
    else if (close[i] < close[i - 1]) out[i] = prev - volume[i];
    else out[i] = prev;
  }
  return out;
}

/**
 * ROC (Rate of Change). period=12 디폴트.
 * ROC = (close - close_N) / close_N × 100
 */
export function roc(close: number[], period: number = 12): Series {
  const n = close.length;
  const out: Series = new Array(n);
  for (let i = period; i < n; i++) {
    const ref = close[i - period];
    if (ref === 0) continue;
    out[i] = ((close[i] - ref) / ref) * 100;
  }
  return out;
}
