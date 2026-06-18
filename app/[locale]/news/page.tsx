import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {absoluteUrl} from "@/lib/site";
import {loadNewsByClass} from "@/lib/data/news";
import {
  NewsSearchPanel,
  type NewsArticleWithAsset,
} from "@/components/panels/NewsSearchPanel";
import {NewsMentionsPanel} from "@/components/panels/NewsMentionsPanel";
import {rankNewsMentions} from "@/lib/data/news-mentions";
import {keywordsForSymbol} from "@/lib/symbols/news-keywords";
import {
  cryptoRegistry,
  usRegistry,
  krRegistry,
  getCryptoBySymbol,
  getUsBySymbol,
  getKrBySymbol,
} from "@/lib/symbols/registry";
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
      // 자체 openGraph 정의 시 layout 기본 images 가 상속되지 않으므로 명시 필수.
      images: [
        {
          url: absoluteUrl("/og/news.png"),
          width: 1200,
          height: 630,
          alt: "통합 뉴스",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [absoluteUrl("/og/news.png")],
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

  // 뉴스 주목 종목 — 로드된 기사 재사용해 전 종목 언급 빈도 집계(추가 쿼리 0).
  const mentions = rankNewsMentions(
    [
      {
        asset: "crypto",
        articles: crypto.articles,
        symbols: cryptoRegistry.map((e) => e.symbol),
        keywordsFor: (s) => keywordsForSymbol("crypto", s),
      },
      {
        asset: "us",
        articles: us.articles,
        symbols: usRegistry.map((e) => e.symbol),
        keywordsFor: (s) => keywordsForSymbol("us", s),
      },
      {
        asset: "kr",
        articles: kr.articles,
        symbols: krRegistry.map((e) => e.symbol),
        keywordsFor: (s) => keywordsForSymbol("kr", s),
      },
    ],
    10
  );
  const nameOf = (asset: AssetClass, symbol: string): string => {
    const e =
      asset === "crypto"
        ? getCryptoBySymbol(symbol)
        : asset === "us"
        ? getUsBySymbol(symbol)
        : getKrBySymbol(symbol);
    if (!e) return symbol.toUpperCase();
    const ko = "nameKo" in e ? e.nameKo : undefined;
    return (locale === "ko" ? ko ?? e.name : e.name) || symbol.toUpperCase();
  };

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

      <NewsMentionsPanel
        mentions={mentions}
        nameOf={nameOf}
        assetLabels={assetLabels}
      />

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
