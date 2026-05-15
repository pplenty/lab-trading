import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

const SHORTCUTS: Array<{href: string; label: string; desc: string}> = [
  {href: "/", label: "대시보드", desc: "3 자산군 통합"},
  {href: "/crypto", label: "코인", desc: "Upbit 라이브 KRW"},
  {href: "/us", label: "해외주식", desc: "Twelve Data"},
  {href: "/kr", label: "국내주식", desc: "KIS"},
  {href: "/backtest/new", label: "백테스트", desc: "일봉 + 3 preset"},
  {href: "/settings", label: "설정", desc: "테마 · 모드 · 컬러 시맨틱"},
];

export default async function NotFound() {
  const tHome = await getTranslations("home");
  const tSearch = await getTranslations("search");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-fg-subtle">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          존재하지 않는 페이지입니다
        </h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          URL 이 바뀌었거나 등록되지 않은 종목 코드일 수 있습니다. 헤더의 검색({" "}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
            /
          </kbd>{" "}
          또는{" "}
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
            ⌘K
          </kbd>
          ) 으로 종목명 / 티커를 직접 입력해 보세요. {tSearch("placeholder")}.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          빠른 진입
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex flex-col gap-0.5 rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
              >
                <span className="text-sm font-medium text-fg">{s.label}</span>
                <span className="text-[11px] text-fg-subtle">{s.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-xs text-fg-subtle">{tHome("kickoffNote")}</p>
    </main>
  );
}
