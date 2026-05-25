import type {IndicatorRow} from "@/lib/types";
import type {ChartOverlay} from "@/components/charts/CandleChart";

// IndicatorRow[] → ChartOverlay[] 변환.
// 가능 overlays: SMA 20/50/200, EMA 12/26, Bollinger upper/lower (middle = SMA 20 과 중복 회피).

// 색상 팔레트 — 차트의 candle (up/down) 색과 충돌 회피, 서로 잘 구분.
const COLORS = {
  sma20: "#f59e0b", // amber
  sma50: "#fb923c", // orange
  sma200: "#3b82f6", // blue
  ema12: "#a855f7", // purple
  ema26: "#ec4899", // pink
  bbUpper: "#94a3b8", // slate
  bbLower: "#94a3b8",
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
