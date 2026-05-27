import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {absoluteUrl} from "@/lib/site";
import {loadNewsByClass} from "@/lib/data/news";
import {
  NewsSearchPanel,
  type NewsArticleWithAsset,
} from "@/components/panels/NewsSearchPanel";
import type {AssetClass} from "@/lib/types";

// 통합 뉴스 — 3 자산군 (crypto + us + kr) 의 최신 헤드라인을 한 화면에.
// 검색 + 자산군/매체 필터 + 자산군 grid / 통합 timeline 토글 (NewsSearchPanel client).

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
    loadNewsByClass("crypto", 30),
    loadNewsByClass("us", 30),
    loadNewsByClass("kr", 30),
  ]);

  const assetLabels: Record<AssetClass, string> = {
    crypto: t("crypto"),
    us: t("us"),
    kr: t("kr").replace(" (Phase 1.5)", ""),
  };

  // 자산군 라벨 붙여 통합
  const articles: NewsArticleWithAsset[] = [
    ...crypto.articles.map((a) => ({...a, asset: "crypto" as const})),
    ...us.articles.map((a) => ({...a, asset: "us" as const})),
    ...kr.articles.map((a) => ({...a, asset: "kr" as const})),
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            통합 뉴스
          </h1>
          <p className="mt-1 text-xs text-fg-subtle">
            코인 · 해외주식 · 국내주식 최신 헤드라인 — 매 30분 자동 갱신 · 검색 ·
            매체 필터
          </p>
        </div>
      </header>

      <NewsSearchPanel
        articles={articles}
        locale={locale}
        assetLabels={assetLabels}
      />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          출처: 한국경제 · 매일경제 · 파이낸셜뉴스 · 토큰포스트. 원문은 각 매체 사이트로 연결.
        </p>
      </footer>
    </main>
  );
}
