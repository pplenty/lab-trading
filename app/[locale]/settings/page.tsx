import {getTranslations} from "next-intl/server";
import {ThemeSwitcher} from "@/components/ThemeSwitcher";
import {ModeSwitcher} from "@/components/ModeSwitcher";
import {LocaleSwitcher} from "@/components/LocaleSwitcher";
import {ColorSemanticSwitcher} from "@/components/ColorSemanticSwitcher";
import {ShortcutsTrigger} from "@/components/ShortcutsTrigger";
import {UserDataReset} from "@/components/panels/UserDataReset";

// 설정 페이지 — 모든 사이트 환경설정을 한 곳에 모음 (yutils 동일 정책).
export const dynamic = "force-static";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tTheme = await getTranslations("theme");
  const tMode = await getTranslations("mode");
  const tColor = await getTranslations("colorSemantics");
  const tFooter = await getTranslations("footer");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-16">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-fg-muted">{tTheme("label")}</span>
          <ThemeSwitcher />
        </section>

        <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-fg-muted">{tMode("label")}</span>
          <ModeSwitcher />
        </section>

        <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-fg-muted">{tColor("label")}</span>
          <ColorSemanticSwitcher />
        </section>

        <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-fg-muted">Language</span>
          <LocaleSwitcher />
        </section>

        <section className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-fg-muted">{tFooter("shortcuts")}</span>
          <ShortcutsTrigger label={tFooter("shortcuts")} variant="primary" />
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-fg-muted">사용자 자산 (localStorage)</p>
            <p className="mt-0.5 text-[11px] text-fg-subtle">
              즐겨찾기 · 최근 본 종목 · 저장된 백테스트 전략. ADR-0016 — 계정 없이 디바이스별 보관.
            </p>
          </div>
          <UserDataReset />
        </section>
      </div>
    </main>
  );
}
