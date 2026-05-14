"use client";

import {useEffect} from "react";
import {useTranslations} from "next-intl";
import {useLocalStorageString} from "@/lib/storage";
import {
  themes,
  groupOrder,
  applyTheme,
  getTheme,
  STORAGE_KEY,
  MODE_KEY,
  DEFAULT_THEME_ID,
  DEFAULT_MODE,
  type Mode,
} from "@/lib/themes";

// 라이트 테마 12 프리셋 select (yutils 차용).
// FOUC 방지는 app/layout.tsx 의 inline init script 가 paint 전 처리.
export function ThemeSwitcher() {
  const t = useTranslations("theme");
  const [themeId, setThemeId] = useLocalStorageString(
    STORAGE_KEY,
    DEFAULT_THEME_ID
  );

  useEffect(() => {
    const theme = getTheme(themeId);
    const mode =
      (localStorage.getItem(MODE_KEY) as Mode | null) ?? DEFAULT_MODE;
    applyTheme(theme, mode);
  }, [themeId]);

  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted">
      <span className="hidden sm:inline">{t("label")}</span>
      <select
        value={themeId}
        onChange={(e) => setThemeId(e.target.value)}
        aria-label={t("ariaLabel")}
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
      >
        {groupOrder.map((group) => (
          <optgroup key={group} label={t(`groups.${group}`)}>
            {themes
              .filter((theme) => theme.group === group)
              .map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
