import {getTranslations} from "next-intl/server";

export const revalidate = 300;
import {loadQuotesList} from "@/lib/data/quotes";
import {cryptoRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import type {Quote} from "@/lib/types";

// 코인 자산군 인덱스 — Upbit (KRW) listQuotes.
// 사용자가 한국 시장이라 KRW 디폴트. 글로벌 USD 표시는 Phase 1.5 (CoinGecko 어댑터 도입 후).

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CryptoIndexPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  try {
    quotes = await loadQuotesList({
      asset: "crypto",
      symbols: cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol),
      listOpts: {limit: 50},
    });
    // 시가총액 순위는 Upbit 에서 제공 X — 거래대금 기준 정렬로 폴백.
    quotes.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const nameMap: Record<string, {name: string; nameKo?: string}> = {};
  for (const e of cryptoRegistry) {
    nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {t("crypto")}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {tSidebar("quotes")} · Upbit KRW
          </p>
        </div>
        <div className="text-xs text-fg-subtle tabular-nums">
          {quotes.length} assets
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
              class: "crypto",
              locale,
              quotes,
              nameMap,
              listName: "코인 시세 (Upbit KRW)",
            }),
          }}
        />
      )}

      <QuoteTable class="crypto" quotes={quotes} nameMap={nameMap} locale={locale} />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: Upbit · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
