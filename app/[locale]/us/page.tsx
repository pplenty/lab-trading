import {getTranslations} from "next-intl/server";
import {loadQuotesList} from "@/lib/data/quotes";
import {usRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import type {Quote} from "@/lib/types";

// 해외주식 자산군 인덱스 — Twelve Data (키 발급 시 실제 API, 미발급 시 GBM 더미).
// USD 가격 + 24h 변동률. KRW 환산은 Phase 1.5+ (ADR-0024).

type Props = {
  params: Promise<{locale: string}>;
};

export default async function UsIndexPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  try {
    quotes = await loadQuotesList({
      asset: "us",
      symbols: usRegistry.map((e) => e.symbol),
      listOpts: {limit: 50},
    });
    quotes.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const nameMap: Record<string, {name: string; nameKo?: string}> = {};
  for (const e of usRegistry) {
    nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
  }

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
              class: "us",
              locale,
              quotes,
              nameMap,
              listName: "해외주식 시세 (Twelve Data USD)",
            }),
          }}
        />
      )}

      <QuoteTable class="us" quotes={quotes} nameMap={nameMap} locale={locale} />

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
