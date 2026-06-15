import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import nextDynamic from "next/dynamic";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {loadQuote} from "@/lib/data/quotes";
import {loadCandleSeries} from "@/lib/data/candles";
import {usRegistry, getUsBySymbol} from "@/lib/symbols/registry";
import {getSymbolDesc} from "@/lib/symbols/descriptions";
import {SymbolIntro} from "@/components/panels/SymbolIntro";
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
import {SimilarSymbolsPanel} from "@/components/panels/SimilarSymbolsPanel";
import {SectorPerformancePanel} from "@/components/panels/SectorPerformancePanel";
import {SymbolBacktestPreview} from "@/components/panels/SymbolBacktestPreview";
import {SymbolRelatedNews} from "@/components/panels/SymbolRelatedNews";
import {SymbolNotesPanel} from "@/components/panels/SymbolNotesPanel";
import {IndicatorPanel} from "@/components/panels/IndicatorPanel";
import {ChartRangeToggle} from "@/components/charts/ChartRangeToggle";
import {TimeframeToggle} from "@/components/charts/TimeframeToggle";
import {parseRangeParam, rangeBars} from "@/lib/chart/range";
import {applyTimeframe, parseTimeframeParam, timeframeLabel} from "@/lib/chart/timeframe";
import {loadIndicatorsForCandles} from "@/lib/data/indicators";
import {computeIndicators} from "@/lib/backfill/indicators-batch";
import {buildIndicatorOverlays, buildVwapOverlay, buildSupertrendOverlays} from "@/lib/chart/overlays";
import {getSector} from "@/lib/symbols/sectors";
import {SectorBadge} from "@/components/SectorBadge";
import {VolatilityPanel} from "@/components/panels/VolatilityPanel";
import {VolumePanel} from "@/components/panels/VolumePanel";
import {PriceLevelsPanel} from "@/components/panels/PriceLevelsPanel";
import {ReturnsPanel} from "@/components/panels/ReturnsPanel";
import {SymbolFaqPanel} from "@/components/panels/SymbolFaqPanel";
import {assetJsonLd} from "@/lib/seo/asset-jsonld";
import type {Quote, CandleSeries} from "@/lib/types";

const InteractiveCandleChart = nextDynamic(() =>
  import("@/components/charts/InteractiveCandleChart").then(
    (m) => m.InteractiveCandleChart
  )
);

// 300초 ISR — cron-warmup 5분 cron 과 정합 (cron 마다 1회 SSR + 사용자 진입 시 hot cache).
// 일봉 컨텍스트라 5분 stale OK. live quote 신선도는 KV 60s + ISR 300s 의 외부 KV 가 보장.
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; symbol: string}>;
}): Promise<Metadata> {
  const {locale, symbol} = await params;
  let normalized: string;
  try {
    normalized = toSymbol(symbol, "us");
  } catch {
    return {};
  }
  const entry = getUsBySymbol(normalized);
  if (!entry) return {};
  const name = locale === "ko" ? entry.nameKo ?? entry.name : entry.name;
  const url = absoluteUrl(`/${locale}/us/${entry.symbol}`);
  // 동적 가격/변동률 — 검색 스니펫 정보 밀도 (컨벤션 D). loadQuote 는 cache() 라 page body 와 dedup.
  let priceFrag = "";
  try {
    const q = await loadQuote("us", entry.symbol);
    if (q && Number.isFinite(q.price)) {
      const priceStr = `$${q.price.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
      const chg = q.changePct24h;
      const sign = chg > 0 ? "+" : "";
      priceFrag = ` 현재가 ${priceStr}${Number.isFinite(chg) ? ` (${sign}${chg.toFixed(2)}%)` : ""}.`;
    }
  } catch {
    /* quote 실패 시 정적 description */
  }
  const intro = getSymbolDesc(entry.symbol);
  const description = intro
    ? `${intro}${priceFrag} ${name}(${entry.ticker}) 일봉 차트 · 26 지표 · 백테스트. ${entry.market} 상장.`
    : `${name} (${entry.ticker})${priceFrag} 일봉 차트 · 26 지표 · 백테스트. ${entry.market} 상장.`;
  return {
    title: `${name} (${entry.ticker}) 시세 · 차트 · 백테스트`,
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
          url: absoluteUrl(`/og/us/${entry.symbol}.png`),
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
      images: [absoluteUrl(`/og/us/${entry.symbol}.png`)],
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

export default async function UsSymbolPage({params, searchParams}: PageProps) {
  const {symbol: rawSymbol} = await params;
  const sp = await searchParams;
  const range = parseRangeParam(sp.range);
  const tf = parseTimeframeParam(sp.tf);
  const bars = rangeBars(range);
  let normalized: string;
  try {
    normalized = toSymbol(rawSymbol, "us");
  } catch {
    notFound();
  }
  const entry = getUsBySymbol(normalized);
  if (!entry) notFound();

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  let quote: Quote | null = null;
  let series: CandleSeries | null = null;
  let fetchError: string | null = null;

  try {
    [quote, series] = await Promise.all([
      loadQuote("us", entry.symbol),
      loadCandleSeries({asset: "us", symbol: entry.symbol, limit: bars}),
    ]);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const priceFmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const volFmt = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });

  const isDemo = quote?.source.includes("demo") || series?.source.includes("demo");

  // 차트 overlay 용 — aggregated candles 기준 indicators
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
    ...(chartIndicators && aggCandles.length > 0
      ? buildSupertrendOverlays(aggCandles, chartIndicators)
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <nav className="mb-6 text-xs text-fg-subtle">
        <Link href="/us" className="hover:text-fg">
          {t("us")}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-fg-muted">{entry.ticker}</span>
      </nav>

      <RecentTracker class="us" symbol={entry.symbol} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: assetJsonLd({
            class: "us",
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

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              {entry.nameKo ?? entry.name}{" "}
              <span className="text-fg-subtle">({entry.ticker})</span>
            </h1>
            <FavoriteButton class="us" symbol={entry.symbol} label={entry.nameKo ?? entry.name} />
            {quote && (
              <AlertButton
                class="us"
                symbol={entry.symbol}
                label={entry.nameKo ?? entry.name}
                currentPrice={quote.price}
                currency="USD"
              />
            )}
            <PaperTradeButton
              class="us"
              symbol={entry.symbol}
              label={entry.nameKo ?? entry.name}
              currentPrice={quote?.price}
              currency="USD"
            />
          </div>
          <p className="flex items-baseline gap-2 text-xs text-fg-subtle">
            <span>{entry.market}</span>
            {(() => {
              const s = getSector("us", entry.symbol);
              return s ? <SectorBadge sector={s} /> : null;
            })()}
          </p>
        </div>
        {quote && (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="text-3xl font-semibold tabular-nums text-fg">
              {priceFmt.format(quote.price)}
            </span>
            <FinancialDelta
              changePct={quote.changePct24h}
              changeAbs={quote.changeAbs24h}
              currency="USD"
              digits={2}
            />
          </div>
        )}
      </header>

      <SymbolActions
        class="us"
        symbol={entry.symbol}
        label={entry.nameKo ?? entry.name}
      />

      {quote && (
        <AlertNotice
          class="us"
          symbol={entry.symbol}
          currentPrice={quote.price}
          currency="USD"
        />
      )}

      <D1FallbackBadge quote={quote} variant="banner" />

      <SymbolIntro symbol={entry.symbol} />

      {isDemo && (
        <div className="mb-4 rounded-md border border-line bg-surface/40 px-3 py-2 text-[11px] text-fg-muted">
          ⚠️ Demo data — Twelve Data API 키 미발급 상태. 가격은 deterministic GBM
          시뮬레이션입니다 (시연 / 백테스트 검증용).
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
          <Stat label="Source" value={isDemo ? "Twelve Data (demo)" : "Twelve Data"} />
        </section>
      )}

      {series && series.candles.length > 0 && (
        <section className="mb-6 rounded-lg border border-line bg-surface/30 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
              {timeframeLabel(tf)} 차트
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <TimeframeToggle basePath={`/us/${entry.symbol}`} current={tf} range={range} />
              <ChartRangeToggle basePath={`/us/${entry.symbol}`} current={range} tf={tf} />
            </div>
          </div>
          <InteractiveCandleChart
            candles={aggCandles}
            height={420}
            showVolume
            availableOverlays={chartOverlays}
            currency="USD"
            priceDigits={2}
          />
        </section>
      )}

      <ReturnsPanel class="us" symbol={entry.symbol} />

      <PriceLevelsPanel class="us" symbol={entry.symbol} currency="USD" />

      <IndicatorPanel class="us" symbol={entry.symbol} />

      <VolatilityPanel class="us" symbol={entry.symbol} />

      <VolumePanel class="us" symbol={entry.symbol} />

      {series && series.candles.length >= 30 && (
        <SymbolBacktestPreview
          class="us"
          symbol={entry.symbol}
          candles={series.candles}
          currency="USD"
        />
      )}

      <SymbolRelatedNews class="us" symbol={entry.symbol} locale="ko" />

      <SymbolFaqPanel
        class="us"
        symbol={entry.symbol}
        displayName={entry.nameKo ?? entry.name}
        label={entry.ticker}
        market={entry.market}
      />

      <SymbolNotesPanel
        class="us"
        symbol={entry.symbol}
        currentPrice={quote?.price}
        currency="USD"
      />

      <SectorPerformancePanel
        class="us"
        symbol={entry.symbol}
        displayName={entry.nameKo ?? entry.name}
      />

      <SimilarSymbolsPanel class="us" symbol={entry.symbol} locale="ko" />

      <RelatedSymbolChips
        class="us"
        currentSymbol={entry.symbol}
        siblings={usRegistry.map((e) => ({
          symbol: e.symbol,
          label: e.nameKo ?? e.name,
          ticker: e.ticker,
        }))}
      />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: {isDemo ? "Twelve Data (demo)" : "Twelve Data"} ·{" "}
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
