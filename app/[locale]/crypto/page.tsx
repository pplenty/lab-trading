import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

export const revalidate = 300;
import {loadQuotesList, loadSparklineCloses} from "@/lib/data/quotes";
import {cryptoRegistry} from "@/lib/symbols/registry";
import {QuoteTable} from "@/components/panels/QuoteTable";
import {SectorChips} from "@/components/panels/SectorChips";
import {getSymbolsBySector} from "@/lib/symbols/sectors";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import {absoluteUrl} from "@/lib/site";
import type {Quote} from "@/lib/types";

// 코인 자산군 인덱스 — Upbit (KRW) listQuotes.
// 사용자가 한국 시장이라 KRW 디폴트. 글로벌 USD 표시는 Phase 1.5 (CoinGecko 어댑터 도입 후).

// 종목 수는 registry 에서 파생 — registry 추가 시 카피 자동 갱신 (count drift 방지).
const CRYPTO_COUNT = cryptoRegistry.length;

export const metadata: Metadata = {
  title: "코인 시세 · 차트",
  description: `비트코인 · 이더리움 · 솔라나 등 ${CRYPTO_COUNT} 종목 Upbit KRW 실시간 시세 · 24h 변동률 · 7일 추세. 일봉 차트 · 백테스트.`,
  alternates: {canonical: absoluteUrl("/ko/crypto")},
  openGraph: {
    title: "코인 시세 · 차트",
    description: `비트코인 · 이더리움 등 ${CRYPTO_COUNT} 종목 Upbit KRW 시세 · 24h 변동률 · 일봉 차트 · 백테스트.`,
    url: absoluteUrl("/ko/crypto"),
    siteName: "trading",
    locale: "ko",
    type: "website",
    images: [
      {
        url: absoluteUrl("/og/crypto.png"),
        width: 1200,
        height: 630,
        alt: "코인 시세 · 차트",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [absoluteUrl("/og/crypto.png")],
  },
};

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{sector?: string | string[]}>;
};

export default async function CryptoIndexPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const sectorFilter = typeof sp.sector === "string" ? sp.sector : undefined;

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");
  const tSidebar = await getTranslations("sidebar.items");

  let quotes: Quote[] = [];
  let fetchError: string | null = null;

  const targetSymbols = sectorFilter
    ? new Set(getSymbolsBySector("crypto", sectorFilter))
    : null;

  try {
    quotes = await loadQuotesList({
      asset: "crypto",
      symbols: cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol),
      listOpts: {limit: 50},
    });
    if (targetSymbols) {
      quotes = quotes.filter((q) => targetSymbols.has(q.symbol));
    }
    // 시가총액 순위는 Upbit 에서 제공 X — 거래대금 기준 정렬로 폴백.
    quotes.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const nameMap: Record<string, {name: string; nameKo?: string}> = {};
  for (const e of cryptoRegistry) {
    nameMap[e.symbol] = {name: e.name, nameKo: e.nameKo};
  }

  // 7일 sparkline — 표 행에 mini chart
  const sparklines = await loadSparklineCloses(quotes.map((q) => q.symbol), 7);

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

      <section className="mb-5">
        <SectorChips class="crypto" current={sectorFilter} />
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
              class: "crypto",
              locale,
              quotes,
              nameMap,
              listName: "코인 시세 (Upbit KRW)",
            }),
          }}
        />
      )}

      <QuoteTable class="crypto" quotes={quotes} nameMap={nameMap} locale={locale} sparklines={sparklines} />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: Upbit · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
