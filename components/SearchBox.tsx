"use client";

import {useEffect, useRef} from "react";
import {useTranslations} from "next-intl";

// 자산군 통합 검색 입력 (ADR-0022).
// 1차 셸 부트 단계는 stub — 정적 인덱스 + D1 LIKE fallback 은 Phase 1.5 후속 PR.
// 현재는 input 만 점등하고 / · ⌘K 단축키로 focus 동기. 결과 listbox 는 빈 상태 / "준비 중" 안내.
export function SearchBox() {
  const t = useTranslations("search");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={t("ariaLabel")}
        aria-expanded={false}
        placeholder={t("placeholder")}
        autoComplete="off"
        disabled
        className="w-full cursor-not-allowed rounded-md border border-line bg-surface py-1.5 pl-3 pr-8 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none sm:w-56"
      />
      <kbd
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-bg px-1 font-mono text-[10px] text-fg-subtle sm:block"
      >
        /
      </kbd>
    </div>
  );
}
