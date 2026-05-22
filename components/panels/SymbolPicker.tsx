"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import {ChevronDown, Search} from "lucide-react";
import {useRouter} from "@/i18n/navigation";
import {getEntry, searchAssets, type SearchEntry} from "@/lib/search";
import {useRecents} from "@/lib/recents";
import {useFavorites, parseFavoriteId} from "@/lib/favorites";
import type {AssetClass} from "@/lib/types";

// 백테스트 페이지에서 종목 직접 선택 — 헤더의 "대상" 영역에 박는다.
// 클릭 시 dropdown — 검색 input + 자산군 그룹 + recents/favorites.
// 선택 시 router.push 로 URL 갱신 (strategyId / params 보존을 위해 query passthrough).

const CLASS_LABELS_KO: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

type Props = {
  /** 현재 선택된 종목 표시명. */
  currentLabel: string;
  /** 선택 시 이동할 path 빌더. 미지정 시 백테스트 페이지 default. */
  destination?: (entry: SearchEntry) => string;
  /** URL 의 strategy/param 등 query 를 다음 진입에서 보존 (백테스트 default 한정). */
  preserveQuery?: Record<string, string | number>;
};

export function SymbolPicker({currentLabel, destination, preserveQuery}: Props) {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {recents} = useRecents();
  const {favorites} = useFavorites();

  useEffect(() => {
    setMounted(true);
  }, []);

  // dropdown 열릴 때 input focus.
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // 외부 클릭 닫기.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const trimmed = query.trim();

  // sections (검색 결과 또는 recents/favorites)
  const entries = useMemo<SearchEntry[]>(() => {
    if (trimmed.length > 0) return searchAssets(trimmed, 20);
    if (!mounted) return [];
    const recentEntries = recents
      .map((r) => getEntry(r.class, r.symbol))
      .filter((e): e is SearchEntry => e !== null);
    const recentKeys = new Set(recentEntries.map((e) => `${e.class}:${e.symbol}`));
    const favoriteEntries = favorites
      .map(parseFavoriteId)
      .map((f) => getEntry(f.class, f.symbol))
      .filter((e): e is SearchEntry => e !== null)
      .filter((e) => !recentKeys.has(`${e.class}:${e.symbol}`));
    return [...recentEntries.slice(0, 5), ...favoriteEntries.slice(0, 5)];
  }, [trimmed, mounted, recents, favorites]);

  // 자산군 그룹화
  const sections = useMemo(() => {
    const groups = new Map<AssetClass, SearchEntry[]>();
    for (const e of entries) {
      const arr = groups.get(e.class) ?? [];
      arr.push(e);
      groups.set(e.class, arr);
    }
    const priority: AssetClass[] = ["crypto", "us", "kr"];
    return Array.from(groups.entries()).sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return priority.indexOf(a[0]) - priority.indexOf(b[0]);
    });
  }, [entries]);

  function selectEntry(entry: SearchEntry) {
    if (destination) {
      router.push(destination(entry));
    } else {
      // default — 백테스트 페이지로 preserveQuery 와 함께
      const params = new URLSearchParams();
      params.set("asset", entry.class);
      params.set("symbol", entry.symbol);
      if (preserveQuery) {
        for (const [k, v] of Object.entries(preserveQuery)) {
          if (k === "asset" || k === "symbol") continue;
          params.set(k, String(v));
        }
      }
      router.push(`/backtest/new?${params.toString()}`);
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-line bg-bg px-2.5 py-1 text-sm font-medium tabular-nums text-fg transition-colors hover:border-fg-subtle hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span>{currentLabel}</span>
        <ChevronDown size={12} aria-hidden="true" className="text-fg-subtle" />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-line bg-bg shadow-lg"
        >
          {/* search input */}
          <div className="relative border-b border-line bg-surface/40 px-3 py-2">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목 · 심볼 검색"
              autoComplete="off"
              className="w-full rounded-md border border-line bg-bg py-1.5 pl-7 pr-2 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          {/* sections */}
          <div className="max-h-80 overflow-y-auto">
            {sections.length === 0 ? (
              <div className="px-4 py-4 text-xs text-fg-muted">
                {trimmed.length > 0
                  ? "검색 결과 없음"
                  : "검색어를 입력하거나 즐겨찾기 / 최근 본 종목을 사용하세요"}
              </div>
            ) : (
              sections.map(([cls, entries]) => (
                <div key={cls} className="border-t border-line/40 first:border-0">
                  <div className="bg-surface/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                    {CLASS_LABELS_KO[cls]} · {entries.length}
                  </div>
                  <ul>
                    {entries.map((entry) => (
                      <li key={`${entry.class}:${entry.symbol}`}>
                        <button
                          type="button"
                          onClick={() => selectEntry(entry)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface"
                        >
                          <span className="flex flex-1 flex-col min-w-0">
                            <span className="truncate font-medium text-fg">
                              {entry.nameKo ?? entry.name}
                            </span>
                            <span className="truncate text-[11px] text-fg-subtle">
                              {entry.ticker}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-subtle">
                            {entry.classLabel}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
