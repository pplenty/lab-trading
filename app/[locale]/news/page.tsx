import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {loadNewsByClass} from "@/lib/data/news";
import {NewsCard} from "@/components/panels/NewsCard";

// 통합 뉴스 — 3 자산군 (crypto + us + kr) 의 최신 헤드라인을 한 화면에.
// 각 자산군 24개씩 + 자산군 인디케이터 라벨.

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const url = absoluteUrl(`/${locale}/news`);
  return {
    title: "통합 뉴스 — 코인 · 해외주식 · 국내주식",
    description:
      "한경·매경·파이낸셜뉴스·토큰포스트 6 매체 RSS 를 30분마다 수집. 코인·해외주식·국내주식 헤드라인을 한 화면에서.",
    alternates: {canonical: url},
    openGraph: {
      title: "통합 뉴스 — trading.jdgrid.com",
      description: "코인 · 해외주식 · 국내주식 최신 헤드라인",
      url,
      siteName: "trading",
      locale,
      type: "website",
    },
  };
}

export default async function CombinedNewsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  const [crypto, us, kr] = await Promise.all([
    loadNewsByClass("crypto", 12),
    loadNewsByClass("us", 12),
    loadNewsByClass("kr", 12),
  ]);

  const groups = [
    {key: "crypto", label: t("crypto"), data: crypto, href: "/crypto/news"},
    {key: "us", label: t("us"), data: us, href: "/us/news"},
    {key: "kr", label: t("kr"), data: kr, href: "/kr/news"},
  ] as const;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            통합 뉴스
          </h1>
          <p className="mt-1 text-xs text-fg-subtle">
            코인 · 해외주식 · 국내주식 최신 헤드라인 — 매 30분 자동 갱신
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {groups.map((g) => (
          <section key={g.key}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
                {g.label}
              </h2>
              <Link
                href={g.href}
                className="text-[11px] text-fg-subtle hover:text-fg"
              >
                전체 →
              </Link>
            </header>
            {g.data.articles.length === 0 ? (
              <div className="rounded-lg border border-line bg-surface/40 p-4 text-xs text-fg-muted">
                수집된 뉴스 없음
              </div>
            ) : (
              <ol className="flex flex-col gap-2">
                {g.data.articles.slice(0, 8).map((a) => (
                  <li key={a.url}>
                    <NewsCard article={a} locale={locale} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          출처: 한국경제 · 매일경제 · 파이낸셜뉴스 · 토큰포스트. 원문은 각 매체 사이트로 연결.
        </p>
      </footer>
    </main>
  );
}
