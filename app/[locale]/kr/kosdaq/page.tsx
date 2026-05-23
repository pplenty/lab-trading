import {getTranslations} from "next-intl/server";
import {loadQuotesList, loadSparklineCloses} from "@/lib/data/quotes";
import {krRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import type {Quote} from "@/lib/types";

// /kr/kosdaq — KOSDAQ 종목만 필터링한 시세 list (ADR-0014 메뉴 split).
// registry.market === "KOSDAQ" 인 종목 (4개, 에코프로 / 에코프로비엠 / 셀트리온헬스케어 / 알테오젠).

export const revalidate = 300;

export const metadata = {
  title: "코스닥 (KOSDAQ) 시세 · 차트",
  description:
    "한국 KOSDAQ 종목 시세 — 에코프로 · 에코프로비엠 · 셀트리온헬스케어 등. 일봉 차트 + 백테스트 진입.",
};

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KosdaqPage({params}: Props) {
  const {locale} = await params;
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  const kosdaqSymbols = krRegistry
    .filter((e) => e.market === "KOSDAQ")
    .map((e) => e.symbol);

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  try {
    quotes = await loadQuotesList({
      asset: "kr",
      symbols: kosdaqSymbols,
      listOpts: {limit: 50},
    });
    quotes.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const nameMap: Record<string, {name: string; nameKo?: string}> = {};
  for (const e of krRegistry) {
    if (e.market === "KOSDAQ") {
      nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
    }
  }

  const sparklines = await loadSparklineCloses(
    quotes.map((q) => q.symbol),
    7
  );

  const isDemo = quotes[0]?.source.includes("demo") ?? true;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-fg-subtle">KOSDAQ</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            코스닥
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {tSidebar("quotes")} · KOSDAQ {kosdaqSymbols.length}종목 · KRW
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isDemo && (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
              Demo data
            </span>
          )}
          <span className="text-fg-subtle tabular-nums">
            {quotes.length} assets
          </span>
        </div>
      </header>

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
              listName: "KOSDAQ 시세 (한국거래소 코스닥시장)",
            }),
          }}
        />
      )}

      <QuoteTable
        class="kr"
        quotes={quotes}
        nameMap={nameMap}
        locale={locale}
        sparklines={sparklines}
      />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}:{" "}
          {isDemo
            ? "KIS (demo, ADR-0007)"
            : "한국투자증권 (KIS) · KRX 코스닥시장"}{" "}
          · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
