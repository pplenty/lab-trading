"use client";

import {useEffect, useRef, useState} from "react";
import {Bell, BellRing, X, Trash2} from "lucide-react";
import {useAlerts, type AlertOp} from "@/lib/alerts";
import type {AssetClass} from "@/lib/types";

// 종목 상세 헤더의 알림 버튼.
// 클릭 → modal (조건 추가 + 기존 알림 list + 제거).

type Props = {
  class: AssetClass;
  symbol: string;
  label: string;
  /** 현재가 — modal 의 default 가격에 사용. */
  currentPrice?: number;
  /** KRW / USD 등 — 입력 placeholder. */
  currency: string;
};

const OP_LABEL: Record<AlertOp, string> = {
  gte: "도달 (≥)",
  lte: "하락 (≤)",
};

export function AlertButton({class: cls, symbol, label, currentPrice, currency}: Props) {
  const {items, add, remove} = useAlerts();
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<AlertOp>("gte");
  const [priceInput, setPriceInput] = useState<string>(
    currentPrice !== undefined ? currentPrice.toFixed(currency === "KRW" ? 0 : 2) : ""
  );
  const modalRef = useRef<HTMLDivElement>(null);

  const myAlerts = items.filter(
    (a) => a.class === cls && a.symbol === symbol
  );
  const hasActive = myAlerts.some((a) => !a.acknowledged);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // 외부 클릭
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // 다음 tick 에 등록 — 버튼 클릭이 즉시 외부로 잡히는 케이스 회피
    const id = setTimeout(
      () => document.addEventListener("mousedown", onClick),
      0
    );
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function submit() {
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price <= 0) return;
    add({class: cls, symbol, label, op, price});
    setPriceInput(
      currentPrice !== undefined
        ? currentPrice.toFixed(currency === "KRW" ? 0 : 2)
        : ""
    );
  }

  const fmt = (n: number) =>
    currency === "KRW"
      ? `₩${n.toLocaleString("ko-KR")}`
      : `${currency === "USD" ? "$" : ""}${n.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={hasActive ? "활성 알림 보기" : "가격 알림 추가"}
        aria-haspopup="dialog"
        className={
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
          (hasActive
            ? "text-[var(--color-up)] hover:bg-surface"
            : "text-fg-subtle hover:bg-surface hover:text-fg")
        }
        title={hasActive ? `활성 알림 ${myAlerts.filter((a) => !a.acknowledged).length}개` : "가격 알림 추가"}
      >
        {hasActive ? <BellRing size={14} /> : <Bell size={14} />}
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
                  {label} 가격 알림
                </h2>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {symbol.toUpperCase()} · 조건 도달 시 다음 진입 시점에 알림
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

            {/* 새 알림 입력 */}
            <div className="mb-5 rounded-md border border-line bg-surface/40 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                새 알림 추가
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={op}
                  onChange={(e) => setOp(e.target.value as AlertOp)}
                  className="rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-fg focus:border-fg focus:outline-none"
                >
                  <option value="gte">{OP_LABEL.gte}</option>
                  <option value="lte">{OP_LABEL.lte}</option>
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder={`가격 (${currency})`}
                  className="flex-1 rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={submit}
                  disabled={!Number.isFinite(Number(priceInput)) || Number(priceInput) <= 0}
                  className="rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  추가
                </button>
              </div>
              {currentPrice !== undefined && (
                <p className="mt-1.5 text-[10px] text-fg-subtle">
                  현재가 {fmt(currentPrice)}
                </p>
              )}
            </div>

            {/* 기존 알림 list */}
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                내 알림 ({myAlerts.length})
              </div>
              {myAlerts.length === 0 ? (
                <p className="rounded-md border border-line bg-surface/30 p-3 text-center text-xs text-fg-muted">
                  설정된 알림 없음
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {myAlerts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2 text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-fg">
                          {OP_LABEL[a.op]} {fmt(a.price)}
                        </span>
                        <span className="text-[10px] text-fg-subtle">
                          {a.triggeredAt
                            ? `도달 ${new Date(a.triggeredAt).toLocaleDateString("ko-KR")}`
                            : `대기 중`}
                          {" · 추가 "}
                          {new Date(a.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        aria-label={`${a.op} ${a.price} 알림 제거`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-4 text-[10px] text-fg-subtle">
              알림은 브라우저에 저장됩니다 (localStorage). 종목 페이지 진입 시 조건
              도달이 자동 감지됩니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
