import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import dynamic from "next/dynamic";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {coingeckoAdapter} from "@/lib/adapters/coingecko";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadQuote} from "@/lib/data/quotes";
import {cryptoRegistry, getCryptoBySymbol} from "@/lib/symbols/registry";
import {toSymbol} from "@/lib/symbols/normalize";
import {FinancialDelta} from "@/components/FinancialDelta";
import {FavoriteButton} from "@/components/FavoriteButton";
import {D1FallbackBadge} from "@/components/D1FallbackBadge";
import {RecentTracker} from "@/components/RecentTracker";
import {SymbolActions} from "@/components/panels/SymbolActions";
import {RelatedSymbolChips} from "@/components/panels/RelatedSymbolChips";
import {SymbolBacktestPreview} from "@/components/panels/SymbolBacktestPreview";
import {assetJsonLd} from "@/lib/seo/asset-jsonld";
import type {Quote, CandleSeries} from "@/lib/types";

// 동적 차트는 ssr:false — lightweight-charts 가 window 의존이라 RSC 직 렌더 X.
const CandleChart = dynamic(() =>
  import("@/components/charts/CandleChart").then((m) => m.CandleChart)
);

// 첫 자산 점등 — `/ko/crypto/btc` 등. Upbit (KRW) 디폴트 어댑터.
// Phase 1.5 에 데이터 소스 라우터 (CoinGecko/Binance/Upbit 우선순위 + fallback) 도입.

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; symbol: string}>;
}): Promise<Metadata> {
  const {locale, symbol} = await params;
  let normalized: string;
  try {
    normalized = toSymbol(symbol, "crypto");
  } catch {
    return {};
  }
  const entry = getCryptoBySymbol(normalized);
  if (!entry) return {};
  const name = locale === "ko" ? entry.nameKo ?? entry.name : entry.name;
  const url = absoluteUrl(`/${locale}/crypto/${entry.symbol}`);
  const description = `${name} (${entry.symbol.toUpperCase()}) 실시간 시세 · 일봉 차트 · 일봉 백테스트. Upbit KRW + CoinGecko 글로벌 데이터.`;
  return {
    title: `${name} (${entry.symbol.toUpperCase()}) 시세 · 차트`,
    description,
    openGraph: {
      title: `${name} (${entry.symbol.toUpperCase()})`,
      description,
      url,
      siteName: "trading",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name} (${entry.symbol.toUpperCase()})`,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

type PageProps = {
  params: Promise<{locale: string; symbol: string}>;
};

export default async function CryptoSymbolPage({params}: PageProps) {
  const {symbol: rawSymbol} = await params;
  let normalized: string;
  try {
    normalized = toSymbol(rawSymbol, "crypto");
  } catch {
    notFound();
  }
  const entry = getCryptoBySymbol(normalized);
  if (!entry || !entry.upbitMarket) {
    notFound();
  }

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  let quote: Quote | null = null;
  let series: CandleSeries | null = null;
  let cgQuote: Quote | null = null;
  let fetchError: string | null = null;

  try {
    [quote, series] = await Promise.all([
      loadQuote("crypto", entry.symbol),
      loadCandleSeries({asset: "crypto", symbol: entry.symbol, limit: 200}),
    ]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  // CoinGecko 글로벌 보조 — USD 가격 / 시가총액 / rank. rate limit 으로 실패해도 메인 데이터에 영향 X.
  try {
    cgQuote = await coingeckoAdapter.getQuote(entry.symbol);
  } catch {
    cgQuote = null;
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <nav className="mb-6 text-xs text-fg-subtle">
        <Link href="/crypto" className="hover:text-fg">
          {t("crypto")}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-fg-muted">{entry.symbol.toUpperCase()}</span>
      </nav>

      <RecentTracker class="crypto" symbol={entry.symbol} />
      <script
        type="application/ld+json"
        // schema.org FinancialProduct + BreadcrumbList — SEO rich snippet
        dangerouslySetInnerHTML={{
          __html: assetJsonLd({
            class: "crypto",
            symbol: entry.symbol,
            ticker: entry.symbol.toUpperCase(),
            name: entry.name,
            nameKo: entry.nameKo,
            market: "Crypto",
            locale: "ko",
            quote,
          }),
        }}
      />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {entry.nameKo ?? entry.name}{" "}
            <span className="text-fg-subtle">({entry.symbol.toUpperCase()})</span>
          </h1>
          <FavoriteButton class="crypto" symbol={entry.symbol} label={entry.nameKo ?? entry.name} />
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

      <SymbolActions class="crypto" symbol={entry.symbol} />

      <D1FallbackBadge quote={quote} variant="banner" />

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
          <p className="mt-2 text-xs text-fg-subtle">
            Upbit Public API 가 호출 불가능한 환경(예: 일부 사내망)일 수 있습니다.
          </p>
        </div>
      )}

      {quote && (
        <section className="mb-6 grid gap-3 text-sm sm:grid-cols-4">
          <Stat label="24h High" value={quote.high24h !== undefined ? priceFmt.format(quote.high24h) : "—"} />
          <Stat label="24h Low" value={quote.low24h !== undefined ? priceFmt.format(quote.low24h) : "—"} />
          <Stat label="24h Volume (KRW)" value={quote.volume24h !== undefined ? volFmt.format(quote.volume24h) : "—"} />
          <Stat label="Source" value="Upbit" />
        </section>
      )}

      {cgQuote && (
        <section className="mb-6 grid gap-3 text-sm sm:grid-cols-4">
          <Stat
            label="USD 가격"
            value={new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: cgQuote.price < 1 ? 6 : 2,
            }).format(cgQuote.price)}
          />
          <Stat
            label="시가총액 (USD)"
            value={
              cgQuote.marketCap !== undefined
                ? new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: "USD",
                    notation: "compact",
                    maximumFractionDigits: 2,
                  }).format(cgQuote.marketCap)
                : "—"
            }
          />
          <Stat
            label="시총 순위"
            value={cgQuote.rank !== undefined ? `#${cgQuote.rank}` : "—"}
          />
          <Stat label="Global source" value="CoinGecko" />
        </section>
      )}

      {series && series.candles.length > 0 && (
        <section className="mb-6 rounded-lg border border-line bg-surface/30 p-3">
          <CandleChart candles={series.candles} height={360} />
        </section>
      )}

      {series && series.candles.length >= 30 && (
        <SymbolBacktestPreview
          class="crypto"
          symbol={entry.symbol}
          candles={series.candles}
          currency="KRW"
        />
      )}

      <RelatedSymbolChips
        class="crypto"
        currentSymbol={entry.symbol}
        siblings={cryptoRegistry
          .filter((e) => e.upbitMarket)
          .map((e) => ({
            symbol: e.symbol,
            label: e.nameKo ?? e.name,
            ticker: e.symbol.toUpperCase(),
          }))}
      />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: Upbit ·{" "}
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
