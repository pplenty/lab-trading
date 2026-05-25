import type {Candle, AssetClass} from "@/lib/types";

// 다중 종목 비교 차트의 normalized series 계산.
// 첫 봉 종가를 100 으로 잡고 나머지를 비율 (close / firstClose × 100) 로 변환.
// 종목별 절대 가격 무관 — 추세 비교만 의도.

export type ComparePoint = {
  /** 첫 종목 기준 align 된 시간축 (unix sec). */
  t: number;
  /** 종목별 normalized 값 — symbol key → close/firstClose × 100. */
  v: number | null;
};

export type CompareEntry = {
  class: AssetClass;
  symbol: string;
  label: string;
  candles: Candle[];
};

export type CompareSeries = {
  entry: CompareEntry;
  /** [{t, v}] — normalized (100 기준). 비어있으면 데이터 부족. */
  points: Array<{t: number; v: number}>;
  /** [{t, v}] — drawdown % (음수). overlay chart 용. */
  drawdownPoints: Array<{t: number; v: number}>;
  /** 총 변동률 (last/first - 1) × 100. */
  totalReturnPct: number | null;
  /** 비교 기간의 max drawdown % (양수 절댓값). */
  mddPct: number | null;
  /** annualized volatility % (일일 log-return std × √252 × 100). */
  volatilityPct: number | null;
  /** annualized Sharpe (rf=0, mean × √252 / std). */
  sharpe: number | null;
  /** daily log returns — correlation 계산용. candles.length - 1. */
  dailyReturns: number[];
};

const TRADING_DAYS = 252;

function stdev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += (v - mean) ** 2;
  return Math.sqrt(sum / values.length);
}

export function normalizeForCompare(entries: CompareEntry[]): CompareSeries[] {
  return entries.map((entry) => {
    const candles = entry.candles;
    if (candles.length < 2) {
      return {
        entry,
        points: [],
        drawdownPoints: [],
        totalReturnPct: null,
        mddPct: null,
        volatilityPct: null,
        sharpe: null,
        dailyReturns: [],
      };
    }
    const first = candles[0].c;
    if (first <= 0) {
      return {
        entry,
        points: [],
        drawdownPoints: [],
        totalReturnPct: null,
        mddPct: null,
        volatilityPct: null,
        sharpe: null,
        dailyReturns: [],
      };
    }
    const points = candles.map((c) => ({
      t: c.t,
      v: (c.c / first) * 100,
    }));
    const last = points[points.length - 1].v;
    const totalReturnPct = last - 100;

    // MDD + drawdown line on normalized series
    let peak = -Infinity;
    let mdd = 0;
    const drawdownPoints: Array<{t: number; v: number}> = [];
    for (const p of points) {
      if (p.v > peak) peak = p.v;
      const dd = peak > 0 ? ((p.v - peak) / peak) * 100 : 0;
      if (dd < mdd) mdd = dd;
      drawdownPoints.push({t: p.t, v: dd});
    }

    // daily log returns — vol / sharpe / correlation 용
    const dailyReturns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1].c;
      const curr = candles[i].c;
      if (prev > 0 && curr > 0) {
        dailyReturns.push(Math.log(curr / prev));
      }
    }
    const meanRet =
      dailyReturns.length > 0
        ? dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length
        : 0;
    const sd = stdev(dailyReturns, meanRet);
    const volatilityPct =
      dailyReturns.length > 1 ? sd * Math.sqrt(TRADING_DAYS) * 100 : null;
    const sharpe =
      sd > 0 ? (meanRet * Math.sqrt(TRADING_DAYS)) / sd : null;

    return {
      entry,
      points,
      drawdownPoints,
      totalReturnPct,
      mddPct: Math.abs(mdd),
      volatilityPct,
      sharpe,
      dailyReturns,
    };
  });
}

/** 두 daily-returns 시리즈의 pearson 상관 — min-length intersection. */
export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  // tail alignment — 같은 끝점 기준 (rolling window 차이 회피)
  const aSlice = a.slice(a.length - n);
  const bSlice = b.slice(b.length - n);
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += aSlice[i];
    sumB += bSlice[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return null;
  return cov / denom;
}

/** N×N correlation matrix (대각선 = 1). */
export function correlationMatrix(seriesList: CompareSeries[]): (number | null)[][] {
  const n = seriesList.length;
  const m: (number | null)[][] = Array.from({length: n}, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    m[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const c = pearsonCorrelation(seriesList[i].dailyReturns, seriesList[j].dailyReturns);
      m[i][j] = c;
      m[j][i] = c;
    }
  }
  return m;
}

/** "us:aapl" / "crypto:btc" 형식 → {class, symbol}. invalid 면 null. */
export function parseCompareToken(raw: string): {class: AssetClass; symbol: string} | null {
  const [cls, sym] = raw.split(":", 2);
  if (!cls || !sym) return null;
  if (cls !== "crypto" && cls !== "us" && cls !== "kr") return null;
  return {class: cls as AssetClass, symbol: sym.toLowerCase()};
}

/** {class, symbol} 배열 → "us:aapl,crypto:btc" 같은 단일 token. */
export function buildCompareTokens(
  entries: Array<{class: AssetClass; symbol: string}>
): string {
  return entries.map((e) => `${e.class}:${e.symbol}`).join(",");
}
