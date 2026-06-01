import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

export const revalidate = 300;
import {loadQuotesList, loadSparklineCloses} from "@/lib/data/quotes";
import {usRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {FearGreedChip} from "@/components/panels/FearGreedChip";
import {SectorChips} from "@/components/panels/SectorChips";
import {loadFearGreed} from "@/lib/market/fear-greed";
import {getSymbolsBySector} from "@/lib/symbols/sectors";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import {absoluteUrl} from "@/lib/site";
import type {Quote} from "@/lib/types";

// 해외주식 자산군 인덱스 — Twelve Data (키 발급 시 실제 API, 미발급 시 GBM 더미).
// USD 가격 + 24h 변동률. KRW 환산은 Phase 1.5+ (ADR-0024).

export const metadata: Metadata = {
  title: "해외주식 시세 · 차트",
  description:
    "애플 · 엔비디아 · 테슬라 등 미국 증시 30 종목 실시간 시세 · 24h 변동률 · 7일 추세. 일봉 차트 · 백테스트.",
  alternates: {canonical: absoluteUrl("/ko/us")},
  openGraph: {
    title: "미국주식 시세 · 차트",
    description:
      "애플 · 엔비디아 등 미국 증시 30 종목 시세 · 24h 변동률 · 일봉 차트 · 백테스트.",
    url: absoluteUrl("/ko/us"),
    siteName: "trading",
    locale: "ko",
    type: "website",
    images: [
      {
        url: absoluteUrl("/og/us.png"),
        width: 1200,
        height: 630,
        alt: "미국주식 시세 · 차트",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [absoluteUrl("/og/us.png")],
  },
};

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{sector?: string | string[]}>;
};

export default async function UsIndexPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const sectorFilter = typeof sp.sector === "string" ? sp.sector : undefined;

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  // sector 필터 — registry 의 sector 매칭 종목만 (없으면 전체)
  const targetSymbols = sectorFilter
    ? new Set(getSymbolsBySector("us", sectorFilter))
    : null;

  try {
    quotes = await loadQuotesList({
      asset: "us",
      symbols: usRegistry.map((e) => e.symbol),
      listOpts: {limit: 50},
    });
    if (targetSymbols) {
      quotes = quotes.filter((q) => targetSymbols.has(q.symbol));
    }
    quotes.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const nameMap: Record<string, {name: string; nameKo?: string}> = {};
  for (const e of usRegistry) {
    nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
  }

  // 7일 sparkline — 표 행에 mini chart
  const [sparklines, fng] = await Promise.all([
    loadSparklineCloses(quotes.map((q) => q.symbol), 7),
    loadFearGreed("us"),
  ]);

  const isDemo = quotes[0]?.source.includes("demo");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("us")}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {tSidebar("quotes")} · Twelve Data · USD
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isDemo && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Demo data
            </span>
          )}
          <span className="text-fg-subtle tabular-nums">{quotes.length} assets</span>
          <FearGreedChip reading={fng} />
        </div>
      </header>

      <section className="mb-5">
        <SectorChips class="us" current={sectorFilter} />
      </section>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {quotes.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: assetListJsonLd({
              class: "us",
              locale,
              quotes,
              nameMap,
              listName: "해외주식 시세 (Twelve Data USD)",
            }),
          }}
        />
      )}

      <QuoteTable class="us" quotes={quotes} nameMap={nameMap} locale={locale} sparklines={sparklines} />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}:{" "}
          {isDemo
            ? "Twelve Data (demo — TWELVE_DATA_API_KEY 발급 후 실시간)"
            : "Twelve Data"}{" "}
          · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
