"use client";

import {useEffect} from "react";
import {useTranslations} from "next-intl";
import {useLocalStorageString} from "@/lib/storage";
import {
  applyTheme,
  getTheme,
  STORAGE_KEY,
  MODE_KEY,
  DEFAULT_MODE,
  type Mode,
} from "@/lib/themes";

const modes: Mode[] = ["system", "light", "dark"];

// system / light / dark 3-way 토글 (yutils 차용).
export function ModeSwitcher() {
  const t = useTranslations("mode");
  const [modeRaw, setModeRaw] = useLocalStorageString(MODE_KEY, DEFAULT_MODE);
  const mode: Mode = (modes as string[]).includes(modeRaw)
    ? (modeRaw as Mode)
    : DEFAULT_MODE;

  useEffect(() => {
    const theme = getTheme(localStorage.getItem(STORAGE_KEY));
    applyTheme(theme, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handler() {
      const theme = getTheme(localStorage.getItem(STORAGE_KEY));
      applyTheme(theme, "system");
    }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return (
    <div
      role="radiogroup"
      aria-label={t("ariaLabel")}
      className="flex items-center gap-1 text-xs"
    >
      {modes.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setModeRaw(m)}
            className={
              active
                ? "rounded-md bg-fg px-2 py-1 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                : "rounded-md px-2 py-1 font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            }
          >
            {t(m)}
          </button>
        );
      })}
    </div>
  );
}
