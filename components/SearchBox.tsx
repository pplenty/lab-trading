"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import {ArrowRight, Clock, Star} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {getEntry, searchAssets, type SearchEntry} from "@/lib/search";
import {useRecents} from "@/lib/recents";
import {useFavorites} from "@/lib/favorites";
import {parseFavoriteId} from "@/lib/favorites";
import type {AssetClass} from "@/lib/types";

// 자산군 통합 검색 (ADR-0022) — 강화판.
// • combobox + ↓↑ Enter Esc + / · ⌘K 글로벌 focus
// • 빈 query: 최근 본 (Clock) + 즐겨찾기 (Star) 노출
// • 입력 query: searchAssets 결과 자산군 그룹화 + 매칭 부분 highlight
// • 마지막 옵션: "전체 결과 페이지 → /search?q=..." fallthrough

const CLASS_LABELS_KO: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

type SectionSource = "recent" | "favorite" | AssetClass;

type Section = {
  kind: SectionSource;
  label: string;
  entries: SearchEntry[];
};

function buildSearchSections(results: SearchEntry[]): Section[] {
  const groups = new Map<AssetClass, SearchEntry[]>();
  for (const e of results) {
    const arr = groups.get(e.class) ?? [];
    arr.push(e);
    groups.set(e.class, arr);
  }
  // 자산군 순서: 결과 가장 많은 순. tie 면 crypto > us > kr.
  const priority: AssetClass[] = ["crypto", "us", "kr"];
  const sorted = Array.from(groups.entries()).sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return priority.indexOf(a[0]) - priority.indexOf(b[0]);
  });
  return sorted.map(([cls, entries]) => ({
    kind: cls,
    label: CLASS_LABELS_KO[cls],
    entries,
  }));
}

/** 문자열의 query 부분에 mark — case-insensitive. */
function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (q.length === 0) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-[var(--accent)]/20 px-0.5 text-fg">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function SearchBox() {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {recents} = useRecents();
  const {favorites} = useFavorites();

  // hydration 이후에만 localStorage 기반 sections 노출 (mismatch 회피).
  useEffect(() => {
    setMounted(true);
  }, []);

  const trimmedQuery = query.trim();

  // sections 계산
  const sections = useMemo<Section[]>(() => {
    if (trimmedQuery.length > 0) {
      const results = searchAssets(trimmedQuery, 8);
      return buildSearchSections(results);
    }
    if (!mounted) return [];
    const recentEntries = recents
      .map((r) => getEntry(r.class, r.symbol))
      .filter((e): e is SearchEntry => e !== null)
      .slice(0, 5);
    const recentSet = new Set(recentEntries.map((e) => `${e.class}:${e.symbol}`));
    const favoriteEntries = favorites
      .map(parseFavoriteId)
      .map((f) => getEntry(f.class, f.symbol))
      .filter((e): e is SearchEntry => e !== null)
      .filter((e) => !recentSet.has(`${e.class}:${e.symbol}`))
      .slice(0, 5);
    const out: Section[] = [];
    if (recentEntries.length > 0) {
      out.push({kind: "recent", label: t("recents"), entries: recentEntries});
    }
    if (favoriteEntries.length > 0) {
      out.push({kind: "favorite", label: t("favorites"), entries: favoriteEntries});
    }
    return out;
  }, [trimmedQuery, mounted, recents, favorites, t]);

  // flat entries — 키보드 nav index 계산용
  const flatEntries = useMemo(
    () => sections.flatMap((s) => s.entries),
    [sections]
  );
  const hasQuery = trimmedQuery.length > 0;
  const viewAllIndex = hasQuery ? flatEntries.length : -1; // 빈 query 일 땐 fallthrough 없음
  const totalOptions = flatEntries.length + (hasQuery ? 1 : 0);

  // 글로벌 / · ⌘K → 인풋 focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ae = document.activeElement as HTMLElement | null;
      const isTyping =
        ae?.tagName === "INPUT" ||
        ae?.tagName === "TEXTAREA" ||
        ae?.isContentEditable;
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 외부 클릭 → listbox 닫기.
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

  function handleSelect() {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function goToSearchPage() {
    const q = trimmedQuery;
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    handleSelect();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (open) setOpen(false);
      else inputRef.current?.blur();
      return;
    }
    if (!open || totalOptions === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalOptions) % totalOptions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === viewAllIndex && hasQuery) {
        goToSearchPage();
      } else {
        const selected = flatEntries[activeIndex];
        if (selected) {
          router.push(`/${selected.class}/${selected.symbol}`);
          handleSelect();
        }
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(totalOptions - 1);
    }
  }

  // dropdown 노출 조건:
  // - query 있으면 항상 (결과 0 도 noResults)
  // - query 없으면 sections 있을 때만 (mounted + recents/favorites 비어 있지 않음)
  const showDropdown = open && (hasQuery || sections.length > 0);
  const activeOptionId = (() => {
    if (!showDropdown) return undefined;
    if (activeIndex === viewAllIndex && hasQuery)
      return `${listboxId}-view-all`;
    const e = flatEntries[activeIndex];
    return e ? `${listboxId}-${e.class}-${e.symbol}` : undefined;
  })();

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t("ariaLabel")}
          aria-controls={listboxId}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={t("placeholder")}
          autoComplete="off"
          className="w-full rounded-md border border-line bg-surface py-1.5 pl-3 pr-8 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none sm:w-56"
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-bg px-1 font-mono text-[10px] text-fg-subtle sm:block"
        >
          /
        </kbd>
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-lg border border-line bg-bg shadow-lg"
        >
          {sections.length === 0 && hasQuery && (
            <div className="px-4 py-3 text-xs text-fg-muted">{t("noResults")}</div>
          )}

          {sections.map((section, sIdx) => {
            const sectionStart = sections
              .slice(0, sIdx)
              .reduce((sum, s) => sum + s.entries.length, 0);
            const SectionIcon =
              section.kind === "recent"
                ? Clock
                : section.kind === "favorite"
                ? Star
                : null;
            return (
              <div key={section.kind} className="border-t border-line/40 first:border-0">
                <div className="flex items-center gap-1.5 bg-surface/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  {SectionIcon && (
                    <SectionIcon size={10} aria-hidden="true" />
                  )}
                  <span>{section.label}</span>
                  <span className="ml-auto tabular-nums text-fg-subtle/70">
                    {section.entries.length}
                  </span>
                </div>
                <ul>
                  {section.entries.map((entry, idx) => {
                    const globalIdx = sectionStart + idx;
                    const isActive = globalIdx === activeIndex;
                    const optionId = `${listboxId}-${entry.class}-${entry.symbol}`;
                    const displayName =
                      locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
                    return (
                      <li key={`${entry.class}:${entry.symbol}`}>
                        <Link
                          id={optionId}
                          role="option"
                          aria-selected={isActive}
                          href={`/${entry.class}/${entry.symbol}`}
                          onClick={handleSelect}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={
                            isActive
                              ? "block bg-surface-hover px-4 py-2"
                              : "block px-4 py-2 transition-colors hover:bg-surface"
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex flex-1 flex-col text-sm min-w-0">
                              <span className="truncate font-medium text-fg">
                                {highlight(displayName, trimmedQuery)}
                              </span>
                              <span className="truncate text-[11px] text-fg-subtle">
                                {highlight(entry.ticker, trimmedQuery)}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-subtle">
                              {entry.classLabel}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {hasQuery && (
            <div
              id={`${listboxId}-view-all`}
              role="option"
              aria-selected={activeIndex === viewAllIndex}
              onMouseEnter={() => setActiveIndex(viewAllIndex)}
              onClick={goToSearchPage}
              className={
                activeIndex === viewAllIndex
                  ? "cursor-pointer border-t border-line bg-surface-hover px-4 py-2.5"
                  : "cursor-pointer border-t border-line px-4 py-2.5 transition-colors hover:bg-surface"
              }
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-fg-muted">
                  <ArrowRight size={11} aria-hidden="true" />
                  <span className="truncate">
                    &ldquo;{trimmedQuery}&rdquo; 전체 결과 보기
                  </span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  Enter
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
