import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

export const revalidate = 300;
import {loadQuotesList, loadSparklineCloses} from "@/lib/data/quotes";
import {krRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {SectorChips} from "@/components/panels/SectorChips";
import {getSymbolsBySector} from "@/lib/symbols/sectors";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import {absoluteUrl} from "@/lib/site";
import type {Quote} from "@/lib/types";

// 국내주식 자산군 인덱스 — KOSPI + KOSDAQ 통합. KIS 키 발급 전이라 demo GBM.
// 시장별 (/kr/kospi · /kr/kosdaq) 분리 인덱스는 후속 PR (메뉴 stub 유지).

export const metadata: Metadata = {
  title: "국내주식 시세 · 차트",
  description:
    "삼성전자 · SK하이닉스 등 KOSPI · KOSDAQ 24 종목 실시간 시세 · 24h 변동률 · 7일 추세. 일봉 차트 · 백테스트.",
  alternates: {canonical: absoluteUrl("/ko/kr")},
};

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{sector?: string | string[]}>;
};

export default async function KrIndexPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const sectorFilter = typeof sp.sector === "string" ? sp.sector : undefined;

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  const targetSymbols = sectorFilter
    ? new Set(getSymbolsBySector("kr", sectorFilter))
    : null;

  try {
    quotes = await loadQuotesList({
      asset: "kr",
      symbols: krRegistry.map((e) => e.symbol),
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
  for (const e of krRegistry) {
    nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
  }

  // 7일 sparkline — 표 행에 mini chart
  const sparklines = await loadSparklineCloses(quotes.map((q) => q.symbol), 7);

  const isDemo = quotes[0]?.source.includes("demo") ?? true;
  const krLabel = t("kr").replace(" (Phase 1.5)", "");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {krLabel}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {tSidebar("quotes")} · KOSPI + KOSDAQ · KRW
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isDemo && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Demo data
            </span>
          )}
          <span className="text-fg-subtle tabular-nums">{quotes.length} assets</span>
        </div>
      </header>

      <section className="mb-5">
        <SectorChips class="kr" current={sectorFilter} />
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
              class: "kr",
              locale,
              quotes,
              nameMap,
              listName: "국내주식 시세 (KOSPI + KOSDAQ KRW)",
            }),
          }}
        />
      )}

      <QuoteTable class="kr" quotes={quotes} nameMap={nameMap} locale={locale} sparklines={sparklines} />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}:{" "}
          {isDemo
            ? "KIS (demo — KIS_APP_KEY/SECRET 발급 후 실시간, ADR-0007)"
            : "한국투자증권 (KIS)"}{" "}
          · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
