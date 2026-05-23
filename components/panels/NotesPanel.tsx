"use client";

import {useMemo, useState} from "react";
import {NotebookPen, Trash2, Pencil, Check, X, Search} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {useNotes, type SymbolNote} from "@/lib/notes";
import {getAssetMeta} from "@/lib/symbols/registry";
import type {AssetClass} from "@/lib/types";

// 사용자 노트 일괄 관리 — /ko/notes.
// 최신순 list / 종목별 group 토글 + 자산군 필터 + 본문/종목명 검색.

type Mode = "latest" | "by-symbol";
type AssetFilter = AssetClass | "all";

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
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

function fmtPrice(price: number, currency?: string): string {
  if (!currency) return price.toLocaleString();
  if (currency === "KRW") return `₩${price.toLocaleString("ko-KR")}`;
  if (currency === "USD")
    return `$${price.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
  return `${currency} ${price.toLocaleString()}`;
}

export function NotesPanel() {
  const {items, update, remove} = useNotes();
  const [mode, setMode] = useState<Mode>("latest");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (assetFilter !== "all") list = list.filter((n) => n.class === assetFilter);
    if (q) {
      list = list.filter((n) => {
        if (n.text.toLowerCase().includes(q)) return true;
        const meta = getAssetMeta(n.class, n.symbol);
        return (
          n.symbol.toLowerCase().includes(q) ||
          (meta?.name?.toLowerCase().includes(q) ?? false) ||
          (meta?.nameKo?.toLowerCase().includes(q) ?? false) ||
          (meta?.ticker?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, assetFilter, query]);

  // 종목별 group (mode === "by-symbol")
  const grouped = useMemo(() => {
    if (mode !== "by-symbol") return [];
    const groups = new Map<string, SymbolNote[]>();
    for (const n of filtered) {
      const key = `${n.class}:${n.symbol}`;
      const arr = groups.get(key) ?? [];
      arr.push(n);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).map(([key, notes]) => {
      const [cls, symbol] = key.split(":") as [AssetClass, string];
      return {cls, symbol, notes};
    });
  }, [filtered, mode]);

  const counts = useMemo(
    () => ({
      total: items.length,
      crypto: items.filter((n) => n.class === "crypto").length,
      us: items.filter((n) => n.class === "us").length,
      kr: items.filter((n) => n.class === "kr").length,
    }),
    [items]
  );

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

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <NotebookPen
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">작성된 메모가 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          종목 상세 페이지 하단의 "내 메모" 영역에서 종목별 관찰 포인트나 매매
          기준을 적어보세요.
        </p>
        <Link
          href="/crypto/btc"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          비트코인으로 시작 →
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* mode toggle + filter + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          {(["latest", "by-symbol"] as Mode[]).map((m) => {
            const label = m === "latest" ? "최신순" : "종목별";
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={
                  active
                    ? "rounded-md bg-fg px-3 py-1 text-xs font-medium text-bg"
                    : "rounded-md border border-line bg-bg px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
                }
              >
                {label}
              </button>
            );
          })}
          <span className="ml-2 text-[11px] text-fg-subtle tabular-nums">
            {filtered.length} / {counts.total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value as AssetFilter)}
            className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
          >
            <option value="all">전체 자산</option>
            <option value="crypto">코인 ({counts.crypto})</option>
            <option value="us">해외주식 ({counts.us})</option>
            <option value="kr">국내주식 ({counts.kr})</option>
          </select>
          <div className="relative">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="본문 · 종목 검색"
              className="w-48 rounded-md border border-line bg-bg py-1 pl-7 pr-2 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center text-xs text-fg-muted">
          매칭 결과 없음
        </div>
      ) : mode === "latest" ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              isEditing={editingId === n.id}
              editValue={editValue}
              onEditChange={setEditValue}
              onStartEdit={() => startEdit(n)}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onRemove={() => remove(n.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(({cls, symbol, notes}) => {
            const meta = getAssetMeta(cls, symbol);
            const displayName =
              meta?.nameKo ?? meta?.name ?? symbol.toUpperCase();
            const ticker = meta?.ticker ?? symbol.toUpperCase();
            return (
              <section
                key={`${cls}:${symbol}`}
                className="rounded-lg border border-line bg-surface/30"
              >
                <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <Link
                    href={`/${cls}/${symbol}`}
                    className="flex items-baseline gap-2 text-sm font-semibold text-fg hover:text-accent"
                  >
                    {displayName}
                    <span className="text-[11px] font-normal text-fg-subtle">
                      {ticker}
                    </span>
                  </Link>
                  <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                    {ASSET_LABEL[cls]} · {notes.length}개
                  </span>
                </header>
                <ul className="flex flex-col divide-y divide-line">
                  {notes.map((n) => (
                    <NoteRow
                      key={n.id}
                      note={n}
                      isEditing={editingId === n.id}
                      editValue={editValue}
                      onEditChange={setEditValue}
                      onStartEdit={() => startEdit(n)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onRemove={() => remove(n.id)}
                      hideSymbol
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  hideSymbol,
}: {
  note: SymbolNote;
  isEditing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  hideSymbol?: boolean;
}) {
  const meta = getAssetMeta(note.class, note.symbol);
  const displayName = meta?.nameKo ?? meta?.name ?? note.symbol.toUpperCase();
  const ticker = meta?.ticker ?? note.symbol.toUpperCase();

  return (
    <li
      className={
        hideSymbol
          ? "p-3"
          : "rounded-md border border-line bg-bg p-3"
      }
    >
      {/* 종목 헤더 (group mode 에서는 숨김) */}
      {!hideSymbol && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <Link
              href={`/${note.class}/${note.symbol}`}
              className="truncate text-sm font-medium text-fg hover:text-accent"
            >
              {displayName}
            </Link>
            <span className="text-[11px] text-fg-subtle">{ticker}</span>
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {ASSET_LABEL[note.class]}
            </span>
          </div>
        </div>
      )}

      {/* 본문 / 편집 */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            autoFocus
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancelEdit();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSaveEdit();
              }
            }}
            className="w-full resize-y rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-fg focus:border-fg focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              aria-label="취소"
              className="inline-flex h-7 items-center rounded-md border border-line bg-bg px-2 text-[11px] text-fg-subtle transition-colors hover:text-fg"
            >
              <X size={11} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-fg px-2 text-[11px] font-medium text-bg transition-opacity hover:opacity-90"
            >
              <Check size={11} aria-hidden="true" />
              저장
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-fg">{note.text}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-fg-subtle">
            <span className="tabular-nums">
              {fmtRelative(note.createdAt)}
              {note.priceAtCreate !== undefined && (
                <> · 그때 {fmtPrice(note.priceAtCreate, note.currency)}</>
              )}
              {note.updatedAt !== note.createdAt && (
                <span className="ml-1 italic">(수정됨)</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onStartEdit}
                aria-label="편집"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
              >
                <Pencil size={11} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("이 메모를 삭제할까요?")) onRemove();
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
}
