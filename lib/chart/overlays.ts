import type {Candle, IndicatorRow} from "@/lib/types";
import type {ChartOverlay} from "@/components/charts/CandleChart";

// IndicatorRow[] → ChartOverlay[] 변환.
// 가능 overlays: SMA 20/50/200, EMA 12/26, Bollinger upper/lower (middle = SMA 20 과 중복 회피),
// + Anchored VWAP (view 시점 기준 누적 — D1 schema 영향 X).

// 색상 팔레트 — 차트의 candle (up/down) 색과 충돌 회피, 서로 잘 구분.
const COLORS = {
  sma20: "#f59e0b", // amber
  sma50: "#fb923c", // orange
  sma200: "#3b82f6", // blue
  ema12: "#a855f7", // purple
  ema26: "#ec4899", // pink
  bbUpper: "#94a3b8", // slate
  bbLower: "#94a3b8",
  vwap: "#14b8a6", // teal
};

export function buildIndicatorOverlays(indicators: IndicatorRow[]): ChartOverlay[] {
  if (indicators.length === 0) return [];
  const ts = indicators.map((r) => r.t);
  return [
    {
      id: "sma20",
      label: "SMA 20",
      color: COLORS.sma20,
      points: ts.map((t, i) => ({t, v: indicators[i].sma_20})),
    },
    {
      id: "sma50",
      label: "SMA 50",
      color: COLORS.sma50,
      points: ts.map((t, i) => ({t, v: indicators[i].sma_50})),
    },
    {
      id: "sma200",
      label: "SMA 200",
      color: COLORS.sma200,
      points: ts.map((t, i) => ({t, v: indicators[i].sma_200})),
    },
    {
      id: "ema12",
      label: "EMA 12",
      color: COLORS.ema12,
      points: ts.map((t, i) => ({t, v: indicators[i].ema_12})),
    },
    {
      id: "ema26",
      label: "EMA 26",
      color: COLORS.ema26,
      points: ts.map((t, i) => ({t, v: indicators[i].ema_26})),
    },
    {
      id: "bbUpper",
      label: "BB Upper",
      color: COLORS.bbUpper,
      dashed: true,
      points: ts.map((t, i) => ({t, v: indicators[i].bb_upper})),
    },
    {
      id: "bbLower",
      label: "BB Lower",
      color: COLORS.bbLower,
      dashed: true,
      points: ts.map((t, i) => ({t, v: indicators[i].bb_lower})),
    },
  ];
}

/**
 * Anchored VWAP — 현재 view 의 첫 봉부터 누적 (typical price × volume) / 누적 volume.
 * D1 schema 영향 X (view-only). volume 가 0 이거나 결측이면 끊김.
 *
 * 일봉 anchored 의미: "이 기간 동안의 평균 진입가" — 현재가가 VWAP 위면 buy avg 위, 아래면 아래.
 */
export function buildVwapOverlay(candles: Candle[]): ChartOverlay {
  let cumPV = 0;
  let cumV = 0;
  const points = candles.map((c) => {
    const typical = (c.h + c.l + c.c) / 3;
    if (Number.isFinite(c.v) && c.v > 0) {
      cumPV += typical * c.v;
      cumV += c.v;
    }
    return {t: c.t, v: cumV > 0 ? cumPV / cumV : undefined};
  });
  return {
    id: "vwap",
    label: "VWAP",
    color: COLORS.vwap,
    points,
  };
}

/**
 * Supertrend overlay — supertrend.ts 전략과 동일 로직. ATR (D1 atr_14) 기반 추세선.
 * 추세 up/down 으로 색이 달라지므로 두 ChartOverlay 로 분리 (up=green / down=red).
 * 각 series 는 자기 추세 구간만 값 보유, 반대 구간은 undefined (라인 끊김).
 *
 * candles 와 indicators (atr_14) 는 length 1:1 가정 (종목 상세 page 가 보장).
 * multiplier default 3 (전략 default 와 동일).
 */
export function buildSupertrendOverlays(
  candles: Candle[],
  indicators: IndicatorRow[],
  multiplier = 3,
  upColor = "#16a34a",
  downColor = "#dc2626"
): ChartOverlay[] {
  const n = Math.min(candles.length, indicators.length);
  if (n === 0) return [];

  const upPoints: Array<{t: number; v: number | undefined}> = [];
  const downPoints: Array<{t: number; v: number | undefined}> = [];

  let prevFinalUpper: number | undefined;
  let prevFinalLower: number | undefined;
  let prevClose: number | undefined;
  let prevTrend: "up" | "down" | undefined;

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const atr = indicators[i]?.atr_14;
    if (atr === undefined || atr <= 0) {
      upPoints.push({t: c.t, v: undefined});
      downPoints.push({t: c.t, v: undefined});
      prevClose = c.c;
      continue;
    }
    const hl2 = (c.h + c.l) / 2;
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;

    const finalUpper =
      prevFinalUpper === undefined ||
      basicUpper < prevFinalUpper ||
      (prevClose !== undefined && prevClose > prevFinalUpper)
        ? basicUpper
        : prevFinalUpper;
    const finalLower =
      prevFinalLower === undefined ||
      basicLower > prevFinalLower ||
      (prevClose !== undefined && prevClose < prevFinalLower)
        ? basicLower
        : prevFinalLower;

    let trend: "up" | "down";
    if (prevTrend === undefined) {
      trend = c.c >= finalUpper ? "up" : "down";
    } else if (prevTrend === "up") {
      trend = c.c < finalLower ? "down" : "up";
    } else {
      trend = c.c > finalUpper ? "up" : "down";
    }

    // 추세선 = up 이면 finalLower (하단 지지), down 이면 finalUpper (상단 저항)
    const lineVal = trend === "up" ? finalLower : finalUpper;
    upPoints.push({t: c.t, v: trend === "up" ? lineVal : undefined});
    downPoints.push({t: c.t, v: trend === "down" ? lineVal : undefined});

    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevClose = c.c;
    prevTrend = trend;
  }

  return [
    {id: "supertrend-up", label: "Supertrend ↑", color: upColor, points: upPoints},
    {id: "supertrend-dn", label: "Supertrend ↓", color: downColor, points: downPoints},
  ];
}
