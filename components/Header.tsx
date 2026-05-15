import {Settings} from "lucide-react";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {SearchBox} from "./SearchBox";
import {MobileSidebarTrigger} from "./MobileSidebarTrigger";

// 헤더 — 사이트 명패 + 통합 검색 + 설정 + 모바일 햄버거.
// 테마 / 모드 / 컬러 시맨틱 / 언어 토글은 모두 /settings 에 모은다 (yutils 와 동일 정책).
export async function Header() {
  const t = await getTranslations("settings");
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-fg transition-colors hover:text-accent"
        >
          trading
        </Link>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-xs sm:ml-auto">
          <SearchBox />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/settings"
            aria-label={t("openLabel")}
            title={t("openLabel")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <MobileSidebarTrigger />
        </div>
      </div>
    </header>
  );
}
