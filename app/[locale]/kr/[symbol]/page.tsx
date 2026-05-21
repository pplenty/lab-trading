import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import nextDynamic from "next/dynamic";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadQuote} from "@/lib/data/quotes";
import {krRegistry, getKrBySymbol} from "@/lib/symbols/registry";
import {toSymbol} from "@/lib/symbols/normalize";
import {FinancialDelta} from "@/components/FinancialDelta";
import {FavoriteButton} from "@/components/FavoriteButton";
import {D1FallbackBadge} from "@/components/D1FallbackBadge";
import {RecentTracker} from "@/components/RecentTracker";
import {SymbolActions} from "@/components/panels/SymbolActions";
import {RelatedSymbolChips} from "@/components/panels/RelatedSymbolChips";
import {SymbolBacktestPreview} from "@/components/panels/SymbolBacktestPreview";
import {SymbolRelatedNews} from "@/components/panels/SymbolRelatedNews";
import {IndicatorPanel} from "@/components/panels/IndicatorPanel";
import {VolatilityPanel} from "@/components/panels/VolatilityPanel";
import {PriceLevelsPanel} from "@/components/panels/PriceLevelsPanel";
import {ReturnsPanel} from "@/components/panels/ReturnsPanel";
import {assetJsonLd} from "@/lib/seo/asset-jsonld";
import type {Quote, CandleSeries} from "@/lib/types";

const CandleChart = nextDynamic(() =>
  import("@/components/charts/CandleChart").then((m) => m.CandleChart)
);

// 60초 ISR — 라이브성 균형 + cold start 회피
export const dynamic = "force-static";
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; symbol: string}>;
}): Promise<Metadata> {
  const {locale, symbol} = await params;
  let normalized: string;
  try {
    normalized = toSymbol(symbol, "kr");
  } catch {
    return {};
  }
  const entry = getKrBySymbol(normalized);
  if (!entry) return {};
  const name = locale === "ko" ? entry.nameKo : entry.name;
  const url = absoluteUrl(`/${locale}/kr/${entry.symbol}`);
  const description = `${name} (${entry.ticker}) 일봉 시세 · 차트 · 백테스트. ${entry.market} 상장.`;
  return {
    title: `${name} (${entry.ticker}) 시세 · 차트`,
    description,
    openGraph: {
      title: `${name} (${entry.ticker})`,
      description,
      url,
      siteName: "trading",
      locale,
      type: "website",
      images: [
        {
          url: absoluteUrl(`/api/og/kr/${entry.symbol}`),
          width: 1200,
          height: 630,
          alt: `${name} (${entry.ticker}) 시세`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} (${entry.ticker})`,
      description,
      images: [absoluteUrl(`/api/og/kr/${entry.symbol}`)],
    },
    alternates: {
      canonical: url,
    },
  };
}

type PageProps = {
  params: Promise<{locale: string; symbol: string}>;
};

export default async function KrSymbolPage({params}: PageProps) {
  const {symbol: rawSymbol} = await params;
  let normalized: string;
  try {
    normalized = toSymbol(rawSymbol, "kr");
  } catch {
    notFound();
  }
  const entry = getKrBySymbol(normalized);
  if (!entry) notFound();

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  let quote: Quote | null = null;
  let series: CandleSeries | null = null;
  let fetchError: string | null = null;

  try {
    [quote, series] = await Promise.all([
      loadQuote("kr", entry.symbol),
      loadCandleSeries({asset: "kr", symbol: entry.symbol, limit: 200}),
    ]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const priceFmt = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  });
  const volFmt = new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 2,
  });

  const isDemo =
    quote?.source.includes("demo") || series?.source.includes("demo");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <RecentTracker class="kr" symbol={entry.symbol} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: assetJsonLd({
            class: "kr",
            symbol: entry.symbol,
            ticker: entry.ticker,
            name: entry.name,
            nameKo: entry.nameKo,
            market: entry.market,
            locale: "ko",
            quote,
          }),
        }}
      />

      <nav className="mb-6 text-xs text-fg-subtle">
        <Link href="/kr" className="hover:text-fg">
          {t("kr").replace(" (Phase 1.5)", "")}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-fg-muted">{entry.ticker}</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {entry.nameKo}{" "}
              <span className="text-fg-subtle">({entry.ticker})</span>
            </h1>
            <FavoriteButton class="kr" symbol={entry.symbol} label={entry.nameKo} />
          </div>
          <p className="text-xs text-fg-subtle">{entry.market}</p>
        </div>
        {quote && (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-3xl font-semibold tabular-nums text-fg">
              {priceFmt.format(quote.price)}
            </span>
            <FinancialDelta
              changePct={quote.changePct24h}
              changeAbs={quote.changeAbs24h}
              currency="KRW"
              digits={2}
            />
          </div>
        )}
      </header>

      <SymbolActions class="kr" symbol={entry.symbol} />

      <D1FallbackBadge quote={quote} variant="banner" />

      {isDemo && (
        <div className="mb-4 rounded-md border border-line bg-surface/40 px-3 py-2 text-[11px] text-fg-muted">
          ⚠️ Demo data — KIS API 키 미발급 상태. 가격은 deterministic GBM
          시뮬레이션 (호가 단위 정수 quantize). 실거래 활성은 ADR-0007 참조.
        </div>
      )}

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {quote && (
        <section className="mb-6 grid gap-3 text-sm sm:grid-cols-4">
          <Stat label="24h High" value={quote.high24h !== undefined ? priceFmt.format(quote.high24h) : "—"} />
          <Stat label="24h Low" value={quote.low24h !== undefined ? priceFmt.format(quote.low24h) : "—"} />
          <Stat label="24h Volume" value={quote.volume24h !== undefined ? volFmt.format(quote.volume24h) : "—"} />
          <Stat label="Source" value={isDemo ? "KIS (demo)" : "KIS"} />
        </section>
      )}

      {series && series.candles.length > 0 && (
        <section className="mb-6 rounded-lg border border-line bg-surface/30 p-3">
          <CandleChart candles={series.candles} height={420} showVolume />
        </section>
      )}

      <ReturnsPanel class="kr" symbol={entry.symbol} />

      <PriceLevelsPanel class="kr" symbol={entry.symbol} currency="KRW" />

      <IndicatorPanel class="kr" symbol={entry.symbol} />

      <VolatilityPanel class="kr" symbol={entry.symbol} />

      {series && series.candles.length >= 30 && (
        <SymbolBacktestPreview
          class="kr"
          symbol={entry.symbol}
          candles={series.candles}
          currency="KRW"
        />
      )}

      <SymbolRelatedNews class="kr" symbol={entry.symbol} locale="ko" />

      <RelatedSymbolChips
        class="kr"
        currentSymbol={entry.symbol}
        siblings={krRegistry.map((e) => ({
          symbol: e.symbol,
          label: e.nameKo,
          ticker: e.ticker,
        }))}
      />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: {isDemo ? "KIS (demo)" : "한국투자증권 (KIS)"} ·{" "}
          {quote ? new Date(quote.updatedAt).toLocaleString("ko-KR") : "—"}
        </p>
      </footer>
    </main>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-md border border-line bg-bg p-3">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="mt-1 text-base font-medium tabular-nums text-fg">{value}</div>
    </div>
  );
}
