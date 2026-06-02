import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {ShortcutsTrigger} from "@/components/ShortcutsTrigger";

// 푸터 — 면책 + 키보드 단축키 + 설정 + 문의.
// ADR-0017 면책 문구: 모든 페이지 footer 에 노출. 백테스트 결과 박스는 별도로 추가 면책.
function SettingsLink({label}: {label: string}) {
  return (
    <Link href="/settings" className="transition-colors hover:text-fg">
      {label}
    </Link>
  );
}

export async function Footer() {
  const t = await getTranslations("footer");
  const tDisclaimer = await getTranslations("disclaimer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-xs text-fg-muted">
        <p>
          © {year} trading · {t("tagline")}
        </p>
        <p className="text-fg-subtle">{tDisclaimer("general")}</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href="/privacy"
            className="font-medium text-fg-muted transition-colors hover:text-fg"
          >
            {t("privacy")}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-fg">
            {t("terms")}
          </Link>
          <Link href="/about" className="transition-colors hover:text-fg">
            {t("about")}
          </Link>
          <ShortcutsTrigger label={t("shortcuts")} variant="subtle" />
          <SettingsLink label={t("settings")} />
          <a
            href="mailto:support@jdgrid.com"
            className="transition-colors hover:text-fg"
          >
            {t("contact")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
