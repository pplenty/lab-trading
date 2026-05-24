"use client";

import {useState} from "react";
import {Share2, Check, Copy, Loader2} from "lucide-react";
import type {BacktestResult} from "@/lib/backtest/types";
import type {AssetClass, Candle} from "@/lib/types";

// 백테스트 결과 공유 — POST /api/backtest/share → short id 발급 → URL 복사.

type Props = {
  asset: AssetClass;
  symbol: string;
  displayName: string;
  displayTicker: string;
  currency: string;
  strategyId: string;
  params: Record<string, number>;
  tf: string;
  initialCapital: number;
  candles: Candle[];
  result: BacktestResult;
};

type State =
  | {kind: "idle"}
  | {kind: "saving"}
  | {kind: "saved"; url: string}
  | {kind: "error"; message: string}
  | {kind: "copied"; url: string};

export function ShareBacktestButton(props: Props) {
  const [state, setState] = useState<State>({kind: "idle"});
  const [note, setNote] = useState("");

  async function share() {
    setState({kind: "saving"});
    try {
      const res = await fetch("/api/backtest/share", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          asset: props.asset,
          symbol: props.symbol,
          displayName: props.displayName,
          displayTicker: props.displayTicker,
          currency: props.currency,
          strategyId: props.strategyId,
          params: props.params,
          tf: props.tf,
          initialCapital: props.initialCapital,
          candles: props.candles,
          result: props.result,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {id: string};
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/ko/backtest/share/${data.id}`;
      setState({kind: "saved", url});
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "공유 실패",
      });
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setState({kind: "copied", url});
      setTimeout(() => setState({kind: "saved", url}), 1800);
    } catch {
      // fallback — 사용자가 직접 select
    }
  }

  if (state.kind === "saved" || state.kind === "copied") {
    const copied = state.kind === "copied";
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/40 p-3 text-xs">
        <span className="text-fg-muted">공유 URL</span>
        <input
          type="text"
          readOnly
          value={state.url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-[200px] rounded-md border border-line bg-bg px-2 py-1 text-xs tabular-nums text-fg focus:border-fg focus:outline-none"
        />
        <button
          type="button"
          onClick={() => copy(state.url)}
          className={
            "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-bg transition-opacity " +
            (copied
              ? "bg-[var(--color-up)]"
              : "bg-fg hover:opacity-90")
          }
        >
          {copied ? (
            <>
              <Check size={11} aria-hidden="true" />
              복사됨
            </>
          ) : (
            <>
              <Copy size={11} aria-hidden="true" />
              복사
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setState({kind: "idle"})}
          className="text-[10px] text-fg-subtle hover:text-fg"
        >
          새 공유
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/40 p-3 text-xs">
      <label className="flex flex-1 items-center gap-2">
        <span className="text-fg-muted">메모 (선택)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="공유 받는 사람에게 한 줄"
          maxLength={200}
          disabled={state.kind === "saving"}
          className="flex-1 min-w-[180px] rounded-md border border-line bg-bg px-2 py-1 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none disabled:opacity-50"
        />
      </label>
      <button
        type="button"
        onClick={share}
        disabled={state.kind === "saving"}
        className="inline-flex h-7 items-center gap-1 rounded-md bg-fg px-3 text-[11px] font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state.kind === "saving" ? (
          <>
            <Loader2 size={11} aria-hidden="true" className="animate-spin" />
            저장 중…
          </>
        ) : (
          <>
            <Share2 size={11} aria-hidden="true" />
            결과 공유 URL 생성
          </>
        )}
      </button>
      {state.kind === "error" && (
        <span className="text-[10px] text-[var(--color-down)]">
          {state.message}
        </span>
      )}
    </div>
  );
}
