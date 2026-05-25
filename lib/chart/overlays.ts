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
