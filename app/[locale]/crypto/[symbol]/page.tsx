import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import nextDynamic from "next/dynamic";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {cache} from "react";
import {coingeckoAdapter} from "@/lib/adapters/coingecko";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadQuote} from "@/lib/data/quotes";
import {cryptoRegistry, getCryptoBySymbol} from "@/lib/symbols/registry";
import {toSymbol} from "@/lib/symbols/normalize";
import {FinancialDelta} from "@/components/FinancialDelta";
import {FavoriteButton} from "@/components/FavoriteButton";
import {AlertButton} from "@/components/AlertButton";
import {PaperTradeButton} from "@/components/PaperTradeButton";
import {AlertNotice} from "@/components/AlertNotice";
import {D1FallbackBadge} from "@/components/D1FallbackBadge";
import {RecentTracker} from "@/components/RecentTracker";
import {SymbolActions} from "@/components/panels/SymbolActions";
import {RelatedSymbolChips} from "@/components/panels/RelatedSymbolChips";
import {SymbolBacktestPreview} from "@/components/panels/SymbolBacktestPreview";
import {SymbolNotesPanel} from "@/components/panels/SymbolNotesPanel";
import {SymbolRelatedNews} from "@/components/panels/SymbolRelatedNews";
import {IndicatorPanel} from "@/components/panels/IndicatorPanel";
import {ChartRangeToggle} from "@/components/charts/ChartRangeToggle";
import {TimeframeToggle} from "@/components/charts/TimeframeToggle";
import {parseRangeParam, rangeBars} from "@/lib/chart/range";
import {applyTimeframe, parseTimeframeParam, timeframeLabel} from "@/lib/chart/timeframe";
import {loadIndicatorsForCandles} from "@/lib/data/indicators";
import {computeIndicators} from "@/lib/backfill/indicators-batch";
import {buildIndicatorOverlays, buildVwapOverlay} from "@/lib/chart/overlays";
import {getSector} from "@/lib/symbols/sectors";
import {SectorBadge} from "@/components/SectorBadge";
import {VolatilityPanel} from "@/components/panels/VolatilityPanel";
import {VolumePanel} from "@/components/panels/VolumePanel";
import {PriceLevelsPanel} from "@/components/panels/PriceLevelsPanel";
import {ReturnsPanel} from "@/components/panels/ReturnsPanel";
import {assetJsonLd} from "@/lib/seo/asset-jsonld";
import type {Quote, CandleSeries} from "@/lib/types";

// 동적 차트는 ssr:false — lightweight-charts 가 window 의존이라 RSC 직 렌더 X.
const InteractiveCandleChart = nextDynamic(() =>
  import("@/components/charts/InteractiveCandleChart").then(
    (m) => m.InteractiveCandleChart
  )
);

// 첫 자산 점등 — `/ko/crypto/btc` 등. Upbit (KRW) 디폴트 어댑터.
// Phase 1.5 에 데이터 소스 라우터 (CoinGecko/Binance/Upbit 우선순위 + fallback) 도입.

// 300초 ISR — cron-warmup 5분 cron 과 정합. live quote 신선도는 KV 60s 가 보장.
export const revalidate = 300;

// CoinGecko cgQuote KV cache 60s — anonymous rate-limit (분당 10-30회) 안전망.
// 26 crypto 종목 × ISR cache miss 시 매번 호출 회피.
const cachedCgQuote = cache(async (symbol: string): Promise<Quote | null> => {
  const key = `cg-quote:${symbol}`;
  const hit = await getKvJson<Quote>(key);
  if (hit) return hit;
  try {
    const fresh = await coingeckoAdapter.getQuote(symbol);
    setKvJson(key, fresh, {ttlSeconds: 60}).catch(() => {});
    return fresh;
  } catch {
    return null;
  }
});

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
      images: [
        {
          url: absoluteUrl(`/api/og/crypto/${entry.symbol}`),
          width: 1200,
          height: 630,
          alt: `${name} (${entry.symbol.toUpperCase()}) 시세`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} (${entry.symbol.toUpperCase()})`,
      description,
      images: [absoluteUrl(`/api/og/crypto/${entry.symbol}`)],
    },
    alternates: {
      canonical: url,
    },
  };
}

type PageProps = {
  params: Promise<{locale: string; symbol: string}>;
  searchParams: Promise<{range?: string | string[]; tf?: string | string[]}>;
};

export default async function CryptoSymbolPage({params, searchParams}: PageProps) {
  const {symbol: rawSymbol} = await params;
  const sp = await searchParams;
  const range = parseRangeParam(sp.range);
  const tf = parseTimeframeParam(sp.tf);
  const bars = rangeBars(range);
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

  // 3 fetch 병렬 — Upbit quote / D1 candles / CoinGecko 보조.
  // CoinGecko 는 rate limit / 실패 시 cgQuote=null 로 swallow (메인 데이터 무관).
  try {
    const [qRes, sRes, cgRes] = await Promise.allSettled([
      loadQuote("crypto", entry.symbol),
      loadCandleSeries({asset: "crypto", symbol: entry.symbol, limit: bars}),
      cachedCgQuote(entry.symbol),
    ]);
    if (qRes.status === "fulfilled") quote = qRes.value;
    else fetchError = qRes.reason instanceof Error ? qRes.reason.message : String(qRes.reason);
    if (sRes.status === "fulfilled") series = sRes.value;
    if (cgRes.status === "fulfilled") cgQuote = cgRes.value;
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

  // 차트 overlay 용 — aggregated candles 기준 indicators 변환
  const aggCandles =
    series && series.candles.length > 0
      ? applyTimeframe(series.candles, tf)
      : [];
  const chartIndicators =
    aggCandles.length > 0
      ? tf === "1d"
        ? await loadIndicatorsForCandles(entry.symbol, aggCandles)
        : computeIndicators(aggCandles)
      : undefined;
  const chartOverlays = [
    ...(chartIndicators ? buildIndicatorOverlays(chartIndicators) : []),
    ...(aggCandles.length > 0 ? [buildVwapOverlay(aggCandles)] : []),
  ];

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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {entry.nameKo ?? entry.name}{" "}
              <span className="text-fg-subtle">({entry.symbol.toUpperCase()})</span>
            </h1>
            <FavoriteButton class="crypto" symbol={entry.symbol} label={entry.nameKo ?? entry.name} />
            {quote && (
              <AlertButton
                class="crypto"
                symbol={entry.symbol}
                label={entry.nameKo ?? entry.name}
                currentPrice={quote.price}
                currency="KRW"
              />
            )}
            <PaperTradeButton
              class="crypto"
              symbol={entry.symbol}
              label={entry.nameKo ?? entry.name}
              currentPrice={quote?.price}
              currency="KRW"
            />
          </div>
          {(() => {
            const s = getSector("crypto", entry.symbol);
            return s ? (
              <p className="flex items-baseline gap-2 text-xs text-fg-subtle">
                <SectorBadge sector={s} />
              </p>
            ) : null;
          })()}
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

      <SymbolActions
        class="crypto"
        symbol={entry.symbol}
        label={entry.nameKo ?? entry.name}
      />

      {quote && (
        <AlertNotice
          class="crypto"
          symbol={entry.symbol}
          currentPrice={quote.price}
          currency="KRW"
        />
      )}

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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {timeframeLabel(tf)} 차트
            </span>
            <div className="flex items-center gap-2">
              <TimeframeToggle basePath={`/crypto/${entry.symbol}`} current={tf} range={range} />
              <ChartRangeToggle basePath={`/crypto/${entry.symbol}`} current={range} tf={tf} />
            </div>
          </div>
          <InteractiveCandleChart
            candles={aggCandles}
            height={420}
            showVolume
            availableOverlays={chartOverlays}
            currency="KRW"
            priceDigits={0}
          />
        </section>
      )}

      <ReturnsPanel class="crypto" symbol={entry.symbol} />

      <PriceLevelsPanel class="crypto" symbol={entry.symbol} currency="KRW" />

      <IndicatorPanel class="crypto" symbol={entry.symbol} />

      <VolatilityPanel class="crypto" symbol={entry.symbol} />

      <VolumePanel class="crypto" symbol={entry.symbol} />

      {series && series.candles.length >= 30 && (
        <SymbolBacktestPreview
          class="crypto"
          symbol={entry.symbol}
          candles={series.candles}
          currency="KRW"
        />
      )}

      <SymbolRelatedNews class="crypto" symbol={entry.symbol} locale="ko" />

      <SymbolNotesPanel
        class="crypto"
        symbol={entry.symbol}
        currentPrice={quote?.price}
        currency="KRW"
      />

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
