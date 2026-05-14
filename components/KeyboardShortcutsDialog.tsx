"use client";

import {useEffect, useRef, useState} from "react";
import {X} from "lucide-react";
import {useTranslations} from "next-intl";

// 글로벌 키보드 단축키 도움말 다이얼로그 (yutils 차용).
// `?` (Shift+/) 키로 열림. 입력 중 또는 modifier 동반 시 무시.
// 외부에서 열려면 `lab-trading:open-shortcuts` custom event 를 document 에 dispatch.
export const OPEN_SHORTCUTS_EVENT = "lab-trading:open-shortcuts";

export function KeyboardShortcutsDialog() {
  const t = useTranslations("shortcuts");
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        const ae = document.activeElement as HTMLElement | null;
        const isTyping =
          ae?.tagName === "INPUT" ||
          ae?.tagName === "TEXTAREA" ||
          ae?.isContentEditable;
        if (isTyping) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener(OPEN_SHORTCUTS_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener(OPEN_SHORTCUTS_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  const items: Array<{keys: string[]; label: string}> = [
    {keys: ["/", "⌘K"], label: t("search")},
    {keys: ["?"], label: t("help")},
    {keys: ["Esc"], label: t("escape")},
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-line bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-fg">
            {t("title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("close")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p className="border-b border-line px-5 py-2.5 text-xs text-fg-muted">
          {t("description")}
        </p>
        <ul className="flex flex-col">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm text-fg odd:bg-surface/40"
            >
              <span>{item.label}</span>
              <span className="flex items-center gap-1">
                {item.keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-[10px] text-fg-subtle">·</span>
                    )}
                    <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-fg">
                      {k}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
