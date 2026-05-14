"use client";

import {OPEN_SHORTCUTS_EVENT} from "@/components/KeyboardShortcutsDialog";

type Props = {
  label: string;
  variant?: "primary" | "subtle";
};

// 키보드 단축키 다이얼로그를 마우스에서도 열 수 있는 진입점 (yutils 차용).
export function ShortcutsTrigger({label, variant = "primary"}: Props) {
  function handleClick() {
    document.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT));
  }

  if (variant === "subtle") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span>{label}</span>
      <kbd className="rounded border border-line bg-surface px-1 font-mono text-[10px] text-fg-subtle">
        ?
      </kbd>
    </button>
  );
}
