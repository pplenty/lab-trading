"use client";

import {useEffect, useMemo, useState} from "react";
import {Plus, X, Play, Copy, Check, Share2, RotateCcw, Bookmark} from "lucide-react";
import {BacktestResultCard} from "./BacktestResultCard";
import {runCustomBacktest} from "@/lib/backtest/run-custom";
import {
  serializeConfig,
  type Comparator,
  type Condition,
  type ConditionGroup,
  type CustomConfig,
  type GroupOp,
  type Operand,
} from "@/lib/backtest/conditions";
import {useSavedStrategies} from "@/lib/strategies/saved";
import type {AssetClass, Candle, IndicatorRow} from "@/lib/types";
import type {BacktestResult} from "@/lib/backtest/types";

// 사용자 정의 백테스트 — 매수/매도 조건을 AND/OR + indicator 비교로 직접 빌드.
// 결과는 기존 BacktestResultCard 재활용 (Replay + 매매 시그널 차트 + trades 표 등).

type Props = {
  class: AssetClass;
  symbol: string;
  currency: string;
  candles: Candle[];
  indicators: IndicatorRow[];
  initialConfig: CustomConfig;
};

const INITIAL_CAPITAL = 10_000_000;
const FEE_PCT = 0.001;
const SLIPPAGE_PCT = 0.0005;

// 사용 가능한 indicator 필드 — D1 26 컬럼 + price 4.
const INDICATOR_FIELDS: Array<{value: string; label: string; group: string}> = [
  {value: "indicator:rsi_14", label: "RSI 14", group: "Momentum"},
  {value: "indicator:macd", label: "MACD", group: "Momentum"},
  {value: "indicator:macd_signal", label: "MACD signal", group: "Momentum"},
  {value: "indicator:macd_hist", label: "MACD hist", group: "Momentum"},
  {value: "indicator:stoch_k_14_3", label: "Stoch %K", group: "Momentum"},
  {value: "indicator:stoch_d_14_3", label: "Stoch %D", group: "Momentum"},
  {value: "indicator:cci_20", label: "CCI 20", group: "Momentum"},
  {value: "indicator:williams_r_14", label: "Williams %R", group: "Momentum"},
  {value: "indicator:roc_12", label: "ROC 12", group: "Momentum"},
  {value: "indicator:sma_5", label: "SMA 5", group: "Trend"},
  {value: "indicator:sma_20", label: "SMA 20", group: "Trend"},
  {value: "indicator:sma_50", label: "SMA 50", group: "Trend"},
  {value: "indicator:sma_100", label: "SMA 100", group: "Trend"},
  {value: "indicator:sma_200", label: "SMA 200", group: "Trend"},
  {value: "indicator:ema_12", label: "EMA 12", group: "Trend"},
  {value: "indicator:ema_26", label: "EMA 26", group: "Trend"},
  {value: "indicator:ema_50", label: "EMA 50", group: "Trend"},
  {value: "indicator:adx_14", label: "ADX 14", group: "Trend"},
  {value: "indicator:di_plus_14", label: "DI+ 14", group: "Trend"},
  {value: "indicator:di_minus_14", label: "DI- 14", group: "Trend"},
  {value: "indicator:bb_upper", label: "BB Upper", group: "Volatility"},
  {value: "indicator:bb_middle", label: "BB Middle", group: "Volatility"},
  {value: "indicator:bb_lower", label: "BB Lower", group: "Volatility"},
  {value: "indicator:atr_14", label: "ATR 14", group: "Volatility"},
  {value: "indicator:obv", label: "OBV", group: "Volume"},
  {value: "indicator:vol_sma_20", label: "Volume SMA 20", group: "Volume"},
  {value: "price:close", label: "close", group: "Price"},
  {value: "price:open", label: "open", group: "Price"},
  {value: "price:high", label: "high", group: "Price"},
  {value: "price:low", label: "low", group: "Price"},
  {value: "price:volume", label: "volume", group: "Price"},
];

const COMPARATORS: Array<{value: Comparator; label: string}> = [
  {value: "gt", label: ">"},
  {value: "lt", label: "<"},
  {value: "gte", label: "≥"},
  {value: "lte", label: "≤"},
  {value: "eq", label: "="},
  {value: "cross_above", label: "↗ cross above"},
  {value: "cross_below", label: "↘ cross below"},
];

function operandToValue(op: Operand): string {
  if (op.kind === "constant") return `const:${op.value}`;
  return `${op.kind}:${op.field}`;
}

function parseOperandValue(v: string, fallbackConstant = 0): Operand {
  if (v.startsWith("const:")) {
    const n = Number(v.slice("const:".length));
    return {kind: "constant", value: Number.isFinite(n) ? n : fallbackConstant};
  }
  if (v.startsWith("indicator:")) {
    return {kind: "indicator", field: v.slice("indicator:".length) as Operand extends {field: infer F} ? F : never} as Operand;
  }
  if (v.startsWith("price:")) {
    return {kind: "price", field: v.slice("price:".length) as "open" | "high" | "low" | "close" | "volume"};
  }
  return {kind: "constant", value: fallbackConstant};
}

export function CustomBacktestPanel({
  class: cls,
  symbol,
  candles,
  indicators,
  currency,
  initialConfig,
}: Props) {
  const [config, setConfig] = useState<CustomConfig>(initialConfig);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  // 현재 config → 공유 URL
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const cfg = serializeConfig(config);
    const params = new URLSearchParams();
    params.set("asset", cls);
    params.set("symbol", symbol);
    params.set("cfg", cfg);
    return `${window.location.origin}/ko/backtest/custom?${params.toString()}`;
  }, [config, cls, symbol]);

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function reset() {
    if (window.confirm("기본 조건 (RSI 단순 평균회귀) 으로 초기화할까요?")) {
      setConfig(initialConfig);
    }
  }

  // 저장
  const {save} = useSavedStrategies();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saved, setSaved] = useState(false);

  function submitSave() {
    const name = saveName.trim();
    if (!name) return;
    save({
      kind: "custom",
      strategyId: "custom",
      name,
      params: {},
      defaultClass: cls,
      defaultSymbol: symbol,
      customConfig: config,
    });
    setSaved(true);
    setTimeout(() => {
      setSaveOpen(false);
      setSaved(false);
      setSaveName("");
    }, 1200);
  }

  // 자동 실행 — config 변경 시 client-side 백테스트.
  useEffect(() => {
    if (candles.length < 2) {
      setResult(null);
      return;
    }
    setRunning(true);
    try {
      const r = runCustomBacktest({
        candles,
        indicators,
        custom: config,
        initialCapital: INITIAL_CAPITAL,
        feePct: FEE_PCT,
        slippagePct: SLIPPAGE_PCT,
        fillModel: "next-open",
      });
      setResult(r);
    } catch (err) {
      console.error("runCustomBacktest failed:", err);
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [config, candles, indicators]);

  const buyValid = config.buy.conditions.length > 0;
  const sellValid = config.sell.conditions.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Share + Reset toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface/30 p-3 text-xs">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Share2 size={12} aria-hidden="true" className="shrink-0 text-fg-subtle" />
          <input
            type="text"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-md border border-line bg-bg px-2 py-1 text-[11px] tabular-nums text-fg-muted focus:border-fg focus:outline-none"
            aria-label="공유 URL"
          />
          <button
            type="button"
            onClick={copyShare}
            disabled={!shareUrl}
            className={
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-bg transition-opacity " +
              (copied
                ? "bg-[var(--color-up)]"
                : "bg-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50")
            }
          >
            {copied ? (
              <>
                <Check size={11} aria-hidden="true" /> 복사됨
              </>
            ) : (
              <>
                <Copy size={11} aria-hidden="true" /> 복사
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
        >
          <Bookmark size={11} aria-hidden="true" />
          전략 저장
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] text-fg-subtle transition-colors hover:border-fg hover:text-fg"
        >
          <RotateCcw size={11} aria-hidden="true" />
          기본값
        </button>
      </div>

      {/* 저장 모달 (간단) */}
      {saveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-lg border border-line bg-bg p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-fg">전략 저장</h3>
            <p className="mt-1 text-xs text-fg-muted">
              현재 조건을 이름 붙여 저장합니다. /backtest/saved 에서 다시 불러올 수
              있습니다.
            </p>
            <input
              type="text"
              autoFocus
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSave();
                if (e.key === "Escape") setSaveOpen(false);
              }}
              placeholder="예: 강세 안에서 RSI dip"
              maxLength={60}
              className="mt-3 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="rounded-md border border-line bg-bg px-3 py-1 text-xs text-fg-muted hover:text-fg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitSave}
                disabled={!saveName.trim() || saved}
                className={
                  "rounded-md px-3 py-1 text-xs font-medium text-bg transition-opacity " +
                  (saved
                    ? "bg-[var(--color-up)]"
                    : "bg-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50")
                }
              >
                {saved ? "저장됨 ✓" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupEditor
          title="매수 조건"
          tone="up"
          group={config.buy}
          onChange={(g) => setConfig((c) => ({...c, buy: g}))}
        />
        <GroupEditor
          title="매도 조건"
          tone="down"
          group={config.sell}
          onChange={(g) => setConfig((c) => ({...c, sell: g}))}
        />
      </div>

      {!buyValid || !sellValid ? (
        <div className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          매수 / 매도 조건 양쪽 모두 최소 1개 필요합니다.
        </div>
      ) : running || !result ? (
        <div className="rounded-md border border-line bg-surface/30 p-6 text-center text-sm text-fg-muted">
          <span className="inline-flex items-center gap-2">
            <Play size={12} aria-hidden="true" className="animate-pulse" />
            백테스트 실행 중…
          </span>
        </div>
      ) : (
        <BacktestResultCard
          result={result}
          initialCapital={INITIAL_CAPITAL}
          currency={currency}
          candles={candles}
          exportName={`${symbol}-custom`}
        />
      )}
    </div>
  );
}

function GroupEditor({
  title,
  tone,
  group,
  onChange,
}: {
  title: string;
  tone: "up" | "down";
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
}) {
  const toneBorder =
    tone === "up"
      ? "border-[var(--color-up)]/40"
      : "border-[var(--color-down)]/40";
  const toneText =
    tone === "up" ? "text-[var(--color-up)]" : "text-[var(--color-down)]";

  function setOp(op: GroupOp) {
    onChange({...group, op});
  }
  function add() {
    onChange({
      ...group,
      conditions: [
        ...group.conditions,
        {
          left: {kind: "indicator", field: "rsi_14"},
          cmp: "lt",
          right: {kind: "constant", value: 30},
        },
      ],
    });
  }
  function update(idx: number, c: Condition) {
    onChange({
      ...group,
      conditions: group.conditions.map((x, i) => (i === idx ? c : x)),
    });
  }
  function remove(idx: number) {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== idx),
    });
  }

  return (
    <section
      className={`rounded-lg border bg-surface/30 p-4 ${toneBorder}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`text-sm font-semibold ${toneText}`}>{title}</h2>
        {group.conditions.length > 1 && (
          <div className="inline-flex rounded-md border border-line bg-bg p-0.5 text-[11px]">
            {(["AND", "OR"] as GroupOp[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setOp(op)}
                aria-pressed={group.op === op}
                className={
                  "rounded px-2.5 py-0.5 font-medium " +
                  (group.op === op
                    ? "bg-fg text-bg"
                    : "text-fg-muted hover:text-fg")
                }
              >
                {op}
              </button>
            ))}
          </div>
        )}
      </header>

      <ul className="flex flex-col gap-2">
        {group.conditions.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5">
            {i > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                {group.op}
              </span>
            )}
            <OperandSelect
              value={c.left}
              onChange={(left) => update(i, {...c, left})}
            />
            <select
              value={c.cmp}
              onChange={(e) =>
                update(i, {...c, cmp: e.target.value as Comparator})
              }
              className="rounded-md border border-line bg-bg px-1.5 py-1 text-xs text-fg focus:border-fg focus:outline-none"
            >
              {COMPARATORS.map((cm) => (
                <option key={cm.value} value={cm.value}>
                  {cm.label}
                </option>
              ))}
            </select>
            <OperandSelect
              value={c.right}
              onChange={(right) => update(i, {...c, right})}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="조건 제거"
              className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-dashed border-line bg-bg px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
      >
        <Plus size={11} aria-hidden="true" />
        조건 추가
      </button>
    </section>
  );
}

function OperandSelect({
  value,
  onChange,
}: {
  value: Operand;
  onChange: (op: Operand) => void;
}) {
  const isConst = value.kind === "constant";
  const selectVal = isConst ? "const:CUSTOM" : operandToValue(value);

  // Indicator/Price → constant 로 전환 시 default 0
  function handleSelectChange(v: string) {
    if (v === "const:CUSTOM") {
      onChange({kind: "constant", value: 0});
      return;
    }
    onChange(parseOperandValue(v));
  }

  // 그룹별 옵션 묶기 — group by data-group attr
  const groups = useMemo(() => {
    const map = new Map<string, typeof INDICATOR_FIELDS>();
    for (const f of INDICATOR_FIELDS) {
      const arr = map.get(f.group) ?? [];
      arr.push(f);
      map.set(f.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={selectVal}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="rounded-md border border-line bg-bg px-1.5 py-1 text-xs text-fg focus:border-fg focus:outline-none"
      >
        <option value="const:CUSTOM">상수…</option>
        {groups.map(([groupName, items]) => (
          <optgroup key={groupName} label={groupName}>
            {items.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {isConst && (
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={value.value}
          onChange={(e) =>
            onChange({
              kind: "constant",
              value: Number(e.target.value),
            })
          }
          className="w-16 rounded-md border border-line bg-bg px-1.5 py-1 text-xs tabular-nums text-fg focus:border-fg focus:outline-none"
        />
      )}
    </span>
  );
}
