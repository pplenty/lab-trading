import {getTranslations} from "next-intl/server";

// 홈 / 대시보드 stub. Phase 1 점등 시 3 자산군 top movers + 주요 지수 + 최근 뉴스 위젯으로 교체.
export default async function HomePage() {
  const t = await getTranslations("home");

  const classes: Array<{key: "crypto" | "us" | "kr" | "backtest"; stub: boolean}> = [
    {key: "crypto", stub: false},
    {key: "us", stub: false},
    {key: "kr", stub: true},
    {key: "backtest", stub: false},
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-16">
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
          {t("phaseBadge")}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-base text-fg-muted">{t("subtitle")}</p>
        <p className="max-w-2xl text-sm text-fg-subtle">{t("phaseDesc")}</p>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t("assetClasses")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {classes.map(({key, stub}) => (
            <li
              key={key}
              className="rounded-lg border border-line bg-surface/40 p-4 transition-colors hover:border-fg"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg">{t(key)}</span>
                {stub && (
                  <span className="rounded-sm border border-line bg-bg px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-fg-subtle">
                    {t("comingSoon")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 max-w-2xl text-sm text-fg-subtle">
        {t("kickoffNote")}
      </p>
    </main>
  );
}
