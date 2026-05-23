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
  /** 총 변동률 (last/first - 1) × 100. */
  totalReturnPct: number | null;
  /** 비교 기간의 max drawdown %. */
  mddPct: number | null;
};

export function normalizeForCompare(entries: CompareEntry[]): CompareSeries[] {
  return entries.map((entry) => {
    const candles = entry.candles;
    if (candles.length < 2) {
      return {entry, points: [], totalReturnPct: null, mddPct: null};
    }
    const first = candles[0].c;
    if (first <= 0) {
      return {entry, points: [], totalReturnPct: null, mddPct: null};
    }
    const points = candles.map((c) => ({
      t: c.t,
      v: (c.c / first) * 100,
    }));
    const last = points[points.length - 1].v;
    const totalReturnPct = last - 100;

    // MDD on normalized series
    let peak = -Infinity;
    let mdd = 0;
    for (const p of points) {
      if (p.v > peak) peak = p.v;
      const dd = peak > 0 ? ((p.v - peak) / peak) * 100 : 0;
      if (dd < mdd) mdd = dd;
    }

    return {
      entry,
      points,
      totalReturnPct,
      mddPct: Math.abs(mdd),
    };
  });
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
