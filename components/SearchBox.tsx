"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Link, useRouter} from "@/i18n/navigation";
import {searchAssets} from "@/lib/search";

// 자산군 통합 검색 (ADR-0022).
// 정적 인덱스 36 종목 (registry crypto/us/kr) — Phase 1.5 D1 LIKE fallback 확장.
// combobox 패턴: ↓↑ navigate, Enter 진입, Escape 닫기, / · ⌘K 글로벌 focus.

export function SearchBox() {
  const t = useTranslations("search");
  const locale = useLocale();
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchAssets(query, 8), [query]);

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

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (open) setOpen(false);
      else inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        router.push(`/${selected.class}/${selected.symbol}`);
        handleSelect();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(results.length - 1);
    }
  }

  const showDropdown = open && query.trim().length > 0;
  const activeId =
    showDropdown && results[activeIndex]
      ? `${listboxId}-${results[activeIndex].class}-${results[activeIndex].symbol}`
      : undefined;

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
          aria-activedescendant={activeId}
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
          className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-lg border border-line bg-bg shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-fg-muted">
              {t("noResults")}
            </div>
          ) : (
            <ul>
              {results.map((entry, idx) => {
                const isActive = idx === activeIndex;
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
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={
                        isActive
                          ? "block bg-surface-hover px-4 py-2.5"
                          : "block px-4 py-2.5 transition-colors hover:bg-surface"
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex flex-1 flex-col text-sm">
                          <span className="truncate font-medium text-fg">
                            {displayName}
                          </span>
                          <span className="truncate text-[11px] text-fg-subtle">
                            {entry.ticker}
                          </span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                          {entry.classLabel}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
