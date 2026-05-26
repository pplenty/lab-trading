import type {Candle, IndicatorRow} from "@/lib/types";

// 사용자 정의 백테스트 조건 — AND/OR 묶음 + indicator 비교.
//
// 평가 모델 (1차):
//   - 매 봉마다 ConditionGroup 평가 → boolean
//   - operand 좌/우 = (indicator field | 상수 | close | open/high/low | volume)
//   - 비교 = lt/gt/lte/gte/eq/cross_above/cross_below
//   - 그룹 op = AND / OR
//   - 그룹 depth = 1 (1차 출시 — 평면 AND/OR. depth 2 는 다음 라운드)
//
// cross_above/cross_below 는 이전 봉 indicator 도 필요 — evaluator 가 prev row 받음.

export type IndicatorField = keyof IndicatorRow;

/** OHLCV 필드 — IndicatorRow 외 candle 자체에서 추출. */
export type PriceField = "open" | "high" | "low" | "close" | "volume";

export type Operand =
  | {kind: "indicator"; field: IndicatorField}
  | {kind: "price"; field: PriceField}
  | {kind: "constant"; value: number};

export type Comparator =
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "eq"
  | "cross_above"
  | "cross_below";

export type Condition = {
  left: Operand;
  cmp: Comparator;
  right: Operand;
};

export type GroupOp = "AND" | "OR";

export type ConditionGroup = {
  op: GroupOp;
  conditions: Condition[];
};

export type CustomConfig = {
  buy: ConditionGroup;
  sell: ConditionGroup;
};

function resolveOperand(
  op: Operand,
  candle: Candle | undefined,
  row: IndicatorRow | undefined
): number | undefined {
  if (!candle) return undefined;
  if (op.kind === "constant") return op.value;
  if (op.kind === "price") {
    if (op.field === "open") return candle.o;
    if (op.field === "high") return candle.h;
    if (op.field === "low") return candle.l;
    if (op.field === "close") return candle.c;
    if (op.field === "volume") return candle.v;
    return undefined;
  }
  // indicator
  if (!row) return undefined;
  const v = (row as Record<string, unknown>)[op.field];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function compare(
  cmp: Comparator,
  a: number | undefined,
  b: number | undefined,
  aPrev: number | undefined,
  bPrev: number | undefined
): boolean {
  if (a === undefined || b === undefined) return false;
  switch (cmp) {
    case "gt":
      return a > b;
    case "lt":
      return a < b;
    case "gte":
      return a >= b;
    case "lte":
      return a <= b;
    case "eq":
      return a === b;
    case "cross_above":
      // 이전 봉 a <= b 이고 현재 a > b
      if (aPrev === undefined || bPrev === undefined) return false;
      return aPrev <= bPrev && a > b;
    case "cross_below":
      if (aPrev === undefined || bPrev === undefined) return false;
      return aPrev >= bPrev && a < b;
  }
}

export function evaluateCondition(
  c: Condition,
  candle: Candle,
  row: IndicatorRow | undefined,
  prevCandle: Candle | undefined,
  prevRow: IndicatorRow | undefined
): boolean {
  const a = resolveOperand(c.left, candle, row);
  const b = resolveOperand(c.right, candle, row);
  const aPrev = resolveOperand(c.left, prevCandle, prevRow);
  const bPrev = resolveOperand(c.right, prevCandle, prevRow);
  return compare(c.cmp, a, b, aPrev, bPrev);
}

export function evaluateGroup(
  g: ConditionGroup,
  candle: Candle,
  row: IndicatorRow | undefined,
  prevCandle: Candle | undefined,
  prevRow: IndicatorRow | undefined
): boolean {
  if (g.conditions.length === 0) return false;
  if (g.op === "AND") {
    for (const c of g.conditions) {
      if (!evaluateCondition(c, candle, row, prevCandle, prevRow)) return false;
    }
    return true;
  }
  // OR
  for (const c of g.conditions) {
    if (evaluateCondition(c, candle, row, prevCandle, prevRow)) return true;
  }
  return false;
}

/** human-readable 조건 표현 — trades.reason 에 사용. */
export function formatCondition(c: Condition): string {
  return `${formatOperand(c.left)} ${formatCmp(c.cmp)} ${formatOperand(c.right)}`;
}
export function formatGroup(g: ConditionGroup): string {
  if (g.conditions.length === 0) return "(no condition)";
  if (g.conditions.length === 1) return formatCondition(g.conditions[0]);
  return g.conditions.map(formatCondition).join(g.op === "AND" ? " AND " : " OR ");
}

function formatOperand(o: Operand): string {
  if (o.kind === "constant") return String(o.value);
  if (o.kind === "price") return o.field;
  return o.field;
}
function formatCmp(c: Comparator): string {
  switch (c) {
    case "gt":
      return ">";
    case "lt":
      return "<";
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    case "eq":
      return "=";
    case "cross_above":
      return "↗ cross";
    case "cross_below":
      return "↘ cross";
  }
}

// ──────────────────────────────────────────────────────────────────────────
// URL serialization — share 가능한 short form. base64 (URL-safe).
// 형식: encodeURIComponent(btoa(JSON.stringify(config))) 단순화 패턴.

export function serializeConfig(cfg: CustomConfig): string {
  const json = JSON.stringify(cfg);
  // URL-safe base64 (+ → -, / → _, padding 제거)
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  // node-side fallback (server 측 — direct buffer)
  return Buffer.from(json, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function deserializeConfig(s: string): CustomConfig | null {
  try {
    let normalized = s.replace(/-/g, "+").replace(/_/g, "/");
    // padding 복원
    while (normalized.length % 4 !== 0) normalized += "=";
    let json: string;
    if (typeof atob !== "undefined") {
      json = decodeURIComponent(escape(atob(normalized)));
    } else {
      json = Buffer.from(normalized, "base64").toString("utf-8");
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.buy || !parsed.sell) return null;
    return parsed as CustomConfig;
  } catch {
    return null;
  }
}
