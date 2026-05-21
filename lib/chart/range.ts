// 차트 시간대 — URL ?range=1m|3m|6m|1y|5y 파싱 + 봉 수 매핑.
// 1d = 1 trading day 기준. 주말/휴장 감안 영업일 ~70% 가정.

export type ChartRange = "1m" | "3m" | "6m" | "1y" | "5y";

export const CHART_RANGES: readonly ChartRange[] = ["1m", "3m", "6m", "1y", "5y"] as const;

export const DEFAULT_RANGE: ChartRange = "6m";

const RANGE_TO_BARS: Record<ChartRange, number> = {
  "1m": 22,
  "3m": 65,
  "6m": 130,
  "1y": 250,
  "5y": 1250,
};

const RANGE_TO_LABEL: Record<ChartRange, string> = {
  "1m": "1개월",
  "3m": "3개월",
  "6m": "6개월",
  "1y": "1년",
  "5y": "5년",
};

export function parseRangeParam(raw: string | string[] | undefined): ChartRange {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (CHART_RANGES as readonly string[]).includes(v)) return v as ChartRange;
  return DEFAULT_RANGE;
}

export function rangeBars(range: ChartRange): number {
  return RANGE_TO_BARS[range];
}

export function rangeLabel(range: ChartRange): string {
  return RANGE_TO_LABEL[range];
}
