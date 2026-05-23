"use client";

import {useState} from "react";
import {NotebookPen, Plus, X, Check, Trash2, Pencil} from "lucide-react";
import {useNotes, type SymbolNote} from "@/lib/notes";
import type {AssetClass} from "@/lib/types";

// 종목 상세의 사용자 노트 panel — localStorage 의존.
// 빠른 텍스트 메모 (PER 18 / 100원 도달시 매수 고려 / 등). TradingView 류 표준 기능.

type Props = {
  class: AssetClass;
  symbol: string;
  /** 메모 작성 시점의 가격 — 후속 컨텍스트. */
  currentPrice?: number;
  currency?: string;
};

function fmtRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.round(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function fmtPrice(price: number, currency: string): string {
  return currency === "KRW"
    ? `₩${price.toLocaleString("ko-KR")}`
    : `${currency === "USD" ? "$" : ""}${price.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;
}

export function SymbolNotesPanel({
  class: cls,
  symbol,
  currentPrice,
  currency = "KRW",
}: Props) {
  const {add, update, remove, notesFor} = useNotes();
  const notes = notesFor(cls, symbol);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function submit() {
    const text = draft.trim();
    if (!text) return;
    add({class: cls, symbol, text, priceAtCreate: currentPrice, currency});
    setDraft("");
  }

  function startEdit(n: SymbolNote) {
    setEditingId(n.id);
    setEditValue(n.text);
  }
  function saveEdit() {
    if (!editingId) return;
    const text = editValue.trim();
    if (text) update(editingId, text);
    setEditingId(null);
    setEditValue("");
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          <NotebookPen size={12} aria-hidden="true" />
          내 메모
        </h2>
        <span className="text-[10px] text-fg-subtle">
          {notes.length}개 · 브라우저 저장
        </span>
      </header>

      {/* 새 메모 입력 */}
      <div className="mb-3 rounded-lg border border-line bg-surface/30 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="이 종목에 대한 메모 — PER 18, 좋은 가격 / 100원 도달 시 매수 고려 / ..."
          rows={2}
          className="w-full resize-y rounded-md border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-fg-subtle">
          <span>
            {currentPrice !== undefined && (
              <>현재가 {fmtPrice(currentPrice, currency)} 함께 저장됩니다 · </>
            )}
            ⌘+Enter
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={draft.trim().length === 0}
            className="inline-flex items-center gap-1 rounded-md bg-fg px-3 py-1 text-[11px] font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={11} aria-hidden="true" />
            추가
          </button>
        </div>
      </div>

      {/* 노트 list */}
      {notes.length === 0 ? (
        <p className="rounded-md border border-line bg-bg/40 p-4 text-center text-xs text-fg-muted">
          아직 메모가 없습니다. 종목 관찰 포인트나 매매 기준을 적어보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => {
            const isEditing = editingId === n.id;
            return (
              <li
                key={n.id}
                className="rounded-md border border-line bg-bg p-3"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          saveEdit();
                        }
                      }}
                      className="w-full resize-y rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-fg focus:border-fg focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="취소"
                        className="inline-flex h-7 items-center rounded-md border border-line bg-bg px-2 text-[11px] text-fg-subtle transition-colors hover:text-fg"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-fg px-2 text-[11px] font-medium text-bg transition-opacity hover:opacity-90"
                      >
                        <Check size={11} aria-hidden="true" />
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-fg">
                      {n.text}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-fg-subtle">
                      <span className="tabular-nums">
                        {fmtRelative(n.createdAt)}
                        {n.priceAtCreate !== undefined && n.currency && (
                          <>
                            {" · 그때 "}
                            {fmtPrice(n.priceAtCreate, n.currency)}
                          </>
                        )}
                        {n.updatedAt !== n.createdAt && (
                          <span className="ml-1 italic">(수정됨)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(n)}
                          aria-label="편집"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
                        >
                          <Pencil size={11} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("이 메모를 삭제할까요?")) {
                              remove(n.id);
                            }
                          }}
                          aria-label="삭제"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
                        >
                          <Trash2 size={11} aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
