"use client";

// ADR-0004: 1차 출시는 ko 단독. EN 은 routing 정의만 유지 (인프라 보존),
// 실제 사용자 노출은 비활성. middleware 가 /en/* → /ko/* redirect.

const locales = [
  {code: "ko", label: "KO", active: true},
  {code: "en", label: "EN", active: false},
] as const;

export function LocaleSwitcher() {
  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      {locales.map((l) => (
        <button
          key={l.code}
          type="button"
          disabled={!l.active}
          aria-current={l.active ? "true" : undefined}
          aria-label={
            l.active ? `Current language: ${l.label}` : `${l.label} (coming in Phase 2)`
          }
          title={l.active ? undefined : "Phase 2 — coming soon"}
          className={
            l.active
              ? "rounded-md bg-fg px-2 py-1 text-bg"
              : "rounded-md px-2 py-1 text-fg-subtle/60 cursor-not-allowed"
          }
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
