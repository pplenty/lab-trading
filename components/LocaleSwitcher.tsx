"use client";

import {useLocale} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";

const locales = [
  {code: "ko", label: "KO"},
  {code: "en", label: "EN"},
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 text-xs font-medium">
      {locales.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => {
              if (!active) router.replace(pathname, {locale: l.code});
            }}
            aria-current={active ? "true" : undefined}
            aria-label={`Switch language to ${l.label}`}
            className={
              active
                ? "rounded-md bg-fg px-2 py-1 text-bg"
                : "rounded-md px-2 py-1 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            }
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
