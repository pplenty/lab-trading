"use client";

import {useEffect} from "react";
import {useTranslations} from "next-intl";
import {useLocalStorageString} from "@/lib/storage";
import {
  applyColorSemantics,
  COLOR_SEMANTICS_KEY,
  DEFAULT_COLOR_SEMANTICS,
  type ColorSemantics,
} from "@/lib/themes";

const variants: ColorSemantics[] = ["korean", "global"];

// 상승/하락 컬러 시맨틱 토글 (ADR-0012).
// 한국식 (빨강 ▲ / 파랑 ▼) ↔ 글로벌식 (초록 ▲ / 빨강 ▼).
// 변경 시 :root 의 data-color-semantics 속성을 갱신 — globals.css 의 룰이 --color-up/--color-down 토큰을 다시 결정.
// FOUC 방지는 app/layout.tsx 의 inline init script.
export function ColorSemanticSwitcher() {
  const t = useTranslations("colorSemantics");
  const [raw, setRaw] = useLocalStorageString(
    COLOR_SEMANTICS_KEY,
    DEFAULT_COLOR_SEMANTICS
  );
  const value: ColorSemantics = (variants as string[]).includes(raw)
    ? (raw as ColorSemantics)
    : DEFAULT_COLOR_SEMANTICS;

  useEffect(() => {
    applyColorSemantics(value);
  }, [value]);

  return (
    <div
      role="radiogroup"
      aria-label={t("ariaLabel")}
      className="flex items-center gap-1 text-xs"
    >
      {variants.map((v) => {
        const active = v === value;
        const hint = v === "korean" ? t("koreanHint") : t("globalHint");
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setRaw(v)}
            title={hint}
            className={
              active
                ? "rounded-md bg-fg px-2 py-1 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                : "rounded-md px-2 py-1 font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            }
          >
            {t(v)}
          </button>
        );
      })}
    </div>
  );
}
