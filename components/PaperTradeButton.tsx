"use client";

import {useEffect, useRef, useState} from "react";
import {Briefcase, X, Trash2, TrendingUp, TrendingDown} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {useTrades, type PaperTrade} from "@/lib/paper";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {AssetClass} from "@/lib/types";

// 종목 상세 헤더의 가상 매매 버튼. 클릭 → modal.
// 현재가 prefill + buy/sell 토글 + units/price 입력 + notes + 보유 position summary.

type Props = {
  class: AssetClass;
  symbol: string;
  label: string;
  currentPrice?: number;
  currency: string;
};

function fmtPrice(p: number, currency: string): string {
  if (currency === "KRW") return `₩${p.toLocaleString("ko-KR")}`;
  if (currency === "USD")
    return `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
  return p.toLocaleString();
}

export function PaperTradeButton({
  class: cls,
  symbol,
  label,
  currentPrice,
  currency,
}: Props) {
  const {add, remove, positionFor, tradesFor} = useTrades();
  const position = positionFor(cls, symbol);
  const trades = tradesFor(cls, symbol);
  const hasPosition = position !== null && position.units > 0;

  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"buy" | "sell">(hasPosition ? "sell" : "buy");
  const [unitsInput, setUnitsInput] = useState("");
  const [priceInput, setPriceInput] = useState(
    currentPrice !== undefined
      ? currentPrice.toFixed(currency === "KRW" ? 0 : 2)
      : ""
  );
  const [notesInput, setNotesInput] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const id = setTimeout(
      () => document.addEventListener("mousedown", onClick),
      0
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // open 시 입력값 reset
  useEffect(() => {
    if (open) {
      setSide(hasPosition ? "sell" : "buy");
      setUnitsInput("");
      setPriceInput(
        currentPrice !== undefined
          ? currentPrice.toFixed(currency === "KRW" ? 0 : 2)
          : ""
      );
      setNotesInput("");
    }
  }, [open, hasPosition, currentPrice, currency]);

  function submit() {
    const units = Number(unitsInput);
    const price = Number(priceInput);
    if (!Number.isFinite(units) || units <= 0) return;
    if (!Number.isFinite(price) || price <= 0) return;
    if (side === "sell" && (!position || units > position.units)) return;
    add({
      class: cls,
      symbol,
      label,
      side,
      units,
      price,
      currency,
      notes: notesInput.trim() || undefined,
    });
    setUnitsInput("");
    setNotesInput("");
  }

  // 거래 가능 여부
  const unitsNum = Number(unitsInput);
  const priceNum = Number(priceInput);
  const valid =
    Number.isFinite(unitsNum) &&
    unitsNum > 0 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    (side === "buy" || (position && unitsNum <= position.units));
  const notional = Number.isFinite(unitsNum * priceNum)
    ? unitsNum * priceNum
    : 0;

  // unrealized PnL (현재가 기준)
  const unrealizedPnl =
    position && position.units > 0 && currentPrice !== undefined
      ? (currentPrice - position.avgPrice) * position.units
      : 0;
  const unrealizedPct =
    position && position.units > 0 && currentPrice !== undefined && position.avgPrice > 0
      ? ((currentPrice - position.avgPrice) / position.avgPrice) * 100
      : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasPosition ? "보유 중 — 가상 매매" : "가상 매매"}
        aria-haspopup="dialog"
        className={
          "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
          (hasPosition
            ? "border-[var(--color-up)]/60 text-[var(--color-up)] hover:bg-[var(--color-up)]/10"
            : "border-line text-fg-muted hover:border-fg-subtle hover:text-fg")
        }
        title={
          hasPosition
            ? `보유 중 ${position!.units} units · 평단 ${fmtPrice(position!.avgPrice, currency)}`
            : "가상 매수/매도"
        }
      >
        <Briefcase size={11} aria-hidden="true" />
        {hasPosition ? "보유 중" : "가상매매"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20"
        >
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-lg border border-line bg-bg p-5 shadow-xl"
          >
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-fg">
                  {label} 가상 매매
                </h2>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {symbol.toUpperCase()} · 실제 매매 없이 시나리오 검증
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>

            {/* position summary (보유 시) */}
            {hasPosition && position && (
              <div className="mb-4 rounded-md border border-[var(--color-up)]/30 bg-[var(--color-up)]/5 p-3 text-xs">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-semibold text-fg">현재 보유</span>
                  <span className="text-fg-muted tabular-nums">
                    {position.units} units
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-fg-subtle">평단가</span>
                  <span className="text-right tabular-nums text-fg-muted">
                    {fmtPrice(position.avgPrice, currency)}
                  </span>
                  <span className="text-fg-subtle">매입원가</span>
                  <span className="text-right tabular-nums text-fg-muted">
                    {fmtPrice(position.avgPrice * position.units, currency)}
                  </span>
                  {currentPrice !== undefined && (
                    <>
                      <span className="text-fg-subtle">평가액</span>
                      <span className="text-right tabular-nums text-fg">
                        {fmtPrice(currentPrice * position.units, currency)}
                      </span>
                      <span className="text-fg-subtle">미실현 PnL</span>
                      <span className="text-right">
                        <FinancialDelta
                          changePct={unrealizedPct}
                          changeAbs={unrealizedPnl}
                          currency={currency}
                          digits={2}
                        />
                      </span>
                    </>
                  )}
                  {position.realizedPnl !== 0 && (
                    <>
                      <span className="text-fg-subtle">확정 PnL</span>
                      <span
                        className={
                          "text-right tabular-nums " +
                          (position.realizedPnl > 0
                            ? "text-[var(--color-up)]"
                            : "text-[var(--color-down)]")
                        }
                      >
                        {position.realizedPnl > 0 ? "+" : ""}
                        {fmtPrice(position.realizedPnl, currency)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 매매 입력 */}
            <div className="mb-5 rounded-md border border-line bg-surface/40 p-3">
              <div className="mb-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSide("buy")}
                  aria-pressed={side === "buy"}
                  className={
                    side === "buy"
                      ? "flex-1 rounded-md bg-[var(--color-up)] px-3 py-1.5 text-xs font-medium text-white"
                      : "flex-1 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-fg-subtle hover:text-fg"
                  }
                >
                  <TrendingUp size={11} aria-hidden="true" className="mr-1 inline" />
                  매수
                </button>
                <button
                  type="button"
                  onClick={() => setSide("sell")}
                  aria-pressed={side === "sell"}
                  disabled={!hasPosition}
                  className={
                    side === "sell"
                      ? "flex-1 rounded-md bg-[var(--color-down)] px-3 py-1.5 text-xs font-medium text-white"
                      : "flex-1 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted hover:border-fg-subtle hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                  }
                  title={!hasPosition ? "보유분이 없어 매도 불가" : ""}
                >
                  <TrendingDown size={11} aria-hidden="true" className="mr-1 inline" />
                  매도
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <span className="w-12">단위</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={unitsInput}
                    onChange={(e) => setUnitsInput(e.target.value)}
                    placeholder={
                      side === "sell" && position
                        ? `최대 ${position.units}`
                        : "주식/코인 수"
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    className="flex-1 rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
                  />
                  {side === "sell" && position && (
                    <button
                      type="button"
                      onClick={() => setUnitsInput(String(position.units))}
                      className="rounded-md border border-line bg-bg px-2 py-1 text-[10px] text-fg-subtle hover:border-fg hover:text-fg"
                    >
                      전량
                    </button>
                  )}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <span className="w-12">단가</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    placeholder={`체결가 (${currency})`}
                    className="flex-1 rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
                  />
                  {currentPrice !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setPriceInput(
                          currentPrice.toFixed(currency === "KRW" ? 0 : 2)
                        )
                      }
                      className="rounded-md border border-line bg-bg px-2 py-1 text-[10px] text-fg-subtle hover:border-fg hover:text-fg"
                    >
                      현재가
                    </button>
                  )}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-fg-subtle">
                  <span className="w-12">메모</span>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="(선택) 진입 이유"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    className="flex-1 rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
                  />
                </label>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-fg-subtle tabular-nums">
                  거래금액{" "}
                  <span className="text-fg-muted">
                    {notional > 0 ? fmtPrice(notional, currency) : "—"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!valid}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 " +
                    (side === "buy"
                      ? "bg-[var(--color-up)] hover:opacity-90"
                      : "bg-[var(--color-down)] hover:opacity-90")
                  }
                >
                  {side === "buy" ? "가상 매수" : "가상 매도"}
                </button>
              </div>
            </div>

            {/* 거래 이력 */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  거래 이력 ({trades.length})
                </div>
                <Link
                  href="/portfolio"
                  className="text-[10px] text-fg-subtle hover:text-fg"
                >
                  전체 포트폴리오 →
                </Link>
              </div>
              {trades.length === 0 ? (
                <p className="rounded-md border border-line bg-surface/30 p-3 text-center text-xs text-fg-muted">
                  아직 가상 매매 기록이 없습니다
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {trades.slice(0, 5).map((t) => (
                    <TradeRow key={t.id} trade={t} onRemove={() => remove(t.id)} />
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-4 text-[10px] text-fg-subtle">
              실제 매매가 아닙니다 (paper trading) · 브라우저에 저장.
              <br />
              포트폴리오 일괄 관리는 <Link href="/portfolio" className="underline hover:text-fg">/portfolio</Link>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function TradeRow({trade, onRemove}: {trade: PaperTrade; onRemove: () => void}) {
  return (
    <li
      className={
        "flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2 text-xs " +
        (trade.side === "buy"
          ? "border-l-2 border-l-[var(--color-up)]"
          : "border-l-2 border-l-[var(--color-down)]")
      }
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-fg">
          <span
            className={
              trade.side === "buy"
                ? "text-[var(--color-up)]"
                : "text-[var(--color-down)]"
            }
          >
            {trade.side === "buy" ? "매수" : "매도"}
          </span>{" "}
          <span className="tabular-nums">{trade.units}</span>{" "}
          <span className="text-fg-subtle">@</span>{" "}
          <span className="tabular-nums">
            {fmtPrice(trade.price, trade.currency)}
          </span>
        </span>
        <span className="text-[10px] text-fg-subtle">
          {new Date(trade.createdAt).toLocaleString("ko-KR")}
          {trade.notes && (
            <span className="ml-1 text-fg-muted">· {trade.notes}</span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("이 거래 기록을 삭제할까요?")) onRemove();
        }}
        aria-label="거래 삭제"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
      >
        <Trash2 size={11} aria-hidden="true" />
      </button>
    </li>
  );
}
