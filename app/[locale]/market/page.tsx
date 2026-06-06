import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {TrendingUp, TrendingDown, Minus} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {
  cryptoRegistry,
  getAssetMeta,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {loadSentiment, type SentimentSnapshot} from "@/lib/market/sentiment";
import {loadFearGreed, loadFearGreedHistory} from "@/lib/market/fear-greed";
import {loadKimchiFromKv} from "@/lib/data/kimchi";
import {FearGreedGauge} from "@/components/panels/FearGreedGauge";
import {FearGreedHistoryChart} from "@/components/panels/FearGreedHistoryChart";
import {KimchiSummaryCard} from "@/components/panels/KimchiSummaryCard";
import {FinancialDelta} from "@/components/FinancialDelta";
import {absoluteUrl} from "@/lib/site";
import type {AssetClass} from "@/lib/types";

// 시장 sentiment dashboard — 공포·탐욕 지수(코인 alternative.me / 미국 VIX 프록시)
// + 자산군 × 80 종목 24h 변동 통계 (상승/하락 분포 · 평균 변동률 · top gainers/losers · 거래대금).
// /ko/market.

export const revalidate = 300;

const OG_MARKET = absoluteUrl("/og/market.png");

export const metadata: Metadata = {
  title: "공포·탐욕 지수 · 시장 분위기 — 코인 · 미국 · 국내",
  description:
    "지금 시장은 공포일까 탐욕일까 — 코인(alternative.me) · 미국 증시(VIX 프록시) 공포·탐욕 지수 + 코인·해외·국내 80 종목 24h 변동 분포 · 상승/하락 종목 수 · 거래대금.",
  alternates: {canonical: absoluteUrl("/ko/market")},
  openGraph: {
    title: "공포·탐욕 지수 · 시장 분위기",
    description:
      "코인 · 미국 증시 공포·탐욕 지수 + 80 종목 24h 변동 분포. 지금 시장 심리를 한눈에.",
    url: absoluteUrl("/ko/market"),
    siteName: "trading",
    locale: "ko",
    type: "website",
    images: [{url: OG_MARKET, width: 1200, height: 630, alt: "공포·탐욕 지수"}],
  },
  twitter: {card: "summary_large_image", images: [OG_MARKET]},
};

const ASSET_LABEL_KO: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

const ASSET_SOURCE: Record<AssetClass, string> = {
  crypto: "Upbit · KRW",
  us: "Twelve Data · USD",
  kr: "KIS · KRW",
};

function compactFmt(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

type Props = {
  params: Promise<{locale: string}>;
};

export default async function MarketPage({params}: Props) {
  const {locale} = await params;
  const tDisc = await getTranslations("disclaimer");

  const cryptoSymbols = cryptoRegistry
    .filter((e) => e.upbitMarket)
    .map((e) => e.symbol);
  const usSymbols = usRegistry.map((e) => e.symbol);
  const krSymbols = krRegistry.map((e) => e.symbol);

  const [crypto, us, kr, fngCrypto, fngUs, histCrypto, histUs, kimchi] =
    await Promise.all([
      loadSentiment("crypto", cryptoSymbols),
      loadSentiment("us", usSymbols),
      loadSentiment("kr", krSymbols),
      loadFearGreed("crypto"),
      loadFearGreed("us"),
      loadFearGreedHistory("crypto", 90),
      loadFearGreedHistory("us", 90),
      loadKimchiFromKv(),
    ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          시장 심리
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          공포 · 탐욕 지수
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          지금 시장은 공포일까 탐욕일까 — 코인 · 미국 증시 심리 지표 + 80 종목 24h 변동 분포
        </p>
      </header>

      {/* 공포·탐욕 게이지 — 외부 지수 (코인 CMC / 미국 feargreedchart) */}
      <section className="mb-4 grid gap-4 sm:grid-cols-2">
        <FearGreedGauge reading={fngCrypto} />
        <FearGreedGauge reading={fngUs} />
      </section>

      {/* 지난 90일 추이 */}
      {(histCrypto.length >= 2 || histUs.length >= 2) && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface/30 p-4 text-fg">
            <h3 className="mb-2 text-xs font-semibold text-fg-muted">
              코인 — 지난 추이
            </h3>
            <FearGreedHistoryChart points={histCrypto} market="코인" />
          </div>
          <div className="rounded-lg border border-line bg-surface/30 p-4 text-fg">
            <h3 className="mb-2 text-xs font-semibold text-fg-muted">
              미국 증시 — 지난 추이
            </h3>
            <FearGreedHistoryChart points={histUs} market="미국 증시" />
          </div>
        </section>
      )}

      {kimchi && kimchi.rows.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-fg">
            코인 한국 프리미엄
          </h2>
          <div className="sm:max-w-md">
            <KimchiSummaryCard snapshot={kimchi} locale={locale} />
          </div>
        </section>
      )}

      <h2 className="mb-3 text-base font-semibold text-fg">
        자산군 24h 변동 분포
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <SentimentCard
          snapshot={crypto}
          locale={locale}
          source={ASSET_SOURCE.crypto}
        />
        <SentimentCard
          snapshot={us}
          locale={locale}
          source={ASSET_SOURCE.us}
        />
        <SentimentCard
          snapshot={kr}
          locale={locale}
          source={ASSET_SOURCE.kr}
        />
      </div>

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          공포·탐욕 지수 — 코인: CoinMarketCap Fear &amp; Greed (0-100, 일 1회) · 실패 시 alternative.me 폴백.
          미국: feargreedchart.com (CNN식 5개 지표 합성, 0-100) · 실패 시 FRED · CBOE VIX 프록시 폴백.
          <strong> 공포·탐욕 지수는 공식 단일 값이 아니라 서비스마다 산출 방식이 다릅니다</strong> (업비트 등 타
          서비스의 수치와 다를 수 있음). 24h 변동 분포는 D1 historical 기반 · 5분 cache.
        </p>
      </footer>
    </main>
  );
}

function SentimentCard({
  snapshot,
  locale,
  source,
}: {
  snapshot: SentimentSnapshot;
  locale: string;
  source: string;
}) {
  const {
    asset,
    totalCount,
    upCount,
    downCount,
    flatCount,
    avgChangePct,
    medianChangePct,
    topGainers,
    topLosers,
    totalVolume,
  } = snapshot;

  // 분위기 — 상승 종목 비율 기반
  const upRatio = totalCount > 0 ? upCount / totalCount : 0;
  const mood: "bullish" | "bearish" | "neutral" =
    upRatio > 0.6 ? "bullish" : upRatio < 0.4 ? "bearish" : "neutral";
  const moodLabel =
    mood === "bullish"
      ? "강세"
      : mood === "bearish"
      ? "약세"
      : "혼조";
  const moodColor =
    mood === "bullish"
      ? "text-[var(--color-up)]"
      : mood === "bearish"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  const cardBorder =
    mood === "bullish"
      ? "border-[var(--color-up)]/40 bg-[var(--color-up)]/5"
      : mood === "bearish"
      ? "border-[var(--color-down)]/40 bg-[var(--color-down)]/5"
      : "border-line bg-surface/30";

  const upBarPct = totalCount > 0 ? (upCount / totalCount) * 100 : 0;
  const downBarPct = totalCount > 0 ? (downCount / totalCount) * 100 : 0;

  return (
    <article className={`rounded-lg border p-4 ${cardBorder}`}>
      {/* 헤더 */}
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <Link
          href={`/${asset}`}
          className="text-base font-semibold text-fg hover:text-accent"
        >
          {ASSET_LABEL_KO[asset]}
        </Link>
        <span className={`text-sm font-semibold ${moodColor}`}>{moodLabel}</span>
      </header>

      {/* 상승/하락 분포 bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-fg-subtle">
          <span>분포</span>
          <span className="tabular-nums">{totalCount} 종목</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full border border-line">
          <span
            className="h-full bg-[var(--color-up)]"
            style={{width: `${upBarPct}%`}}
            aria-label={`상승 ${upCount}`}
          />
          <span
            className="h-full bg-[var(--color-fg-muted)] opacity-30"
            style={{width: `${100 - upBarPct - downBarPct}%`}}
            aria-label={`보합 ${flatCount}`}
          />
          <span
            className="h-full bg-[var(--color-down)]"
            style={{width: `${downBarPct}%`}}
            aria-label={`하락 ${downCount}`}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums">
          <span className="text-[var(--color-up)]">
            <TrendingUp size={9} className="mr-0.5 inline" aria-hidden="true" />
            {upCount}
          </span>
          <span className="text-fg-subtle">
            <Minus size={9} className="mr-0.5 inline" aria-hidden="true" />
            {flatCount}
          </span>
          <span className="text-[var(--color-down)]">
            <TrendingDown size={9} className="mr-0.5 inline" aria-hidden="true" />
            {downCount}
          </span>
        </div>
      </div>

      {/* 평균 / 중앙값 */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-line bg-bg p-2">
          <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
            평균 24h
          </div>
          <div className="mt-0.5 tabular-nums">
            <FinancialDelta changePct={avgChangePct} digits={2} />
          </div>
        </div>
        <div className="rounded-md border border-line bg-bg p-2">
          <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
            중앙값
          </div>
          <div className="mt-0.5 tabular-nums">
            <FinancialDelta changePct={medianChangePct} digits={2} />
          </div>
        </div>
      </div>

      {/* Top gainers */}
      {topGainers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            ▲ Top Gainers
          </div>
          <ul className="flex flex-col gap-0.5">
            {topGainers.map((g) => {
              const meta = getAssetMeta(asset, g.symbol);
              const name = meta
                ? locale === "ko" && meta.nameKo
                  ? meta.nameKo
                  : meta.name
                : g.symbol.toUpperCase();
              return (
                <li key={g.symbol}>
                  <Link
                    href={`/${asset}/${g.symbol}`}
                    prefetch={false}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-surface"
                  >
                    <span className="truncate text-fg">{name}</span>
                    <FinancialDelta changePct={g.changePct} digits={2} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Top losers */}
      {topLosers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
            ▼ Top Losers
          </div>
          <ul className="flex flex-col gap-0.5">
            {topLosers.map((l) => {
              const meta = getAssetMeta(asset, l.symbol);
              const name = meta
                ? locale === "ko" && meta.nameKo
                  ? meta.nameKo
                  : meta.name
                : l.symbol.toUpperCase();
              return (
                <li key={l.symbol}>
                  <Link
                    href={`/${asset}/${l.symbol}`}
                    prefetch={false}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-surface"
                  >
                    <span className="truncate text-fg">{name}</span>
                    <FinancialDelta changePct={l.changePct} digits={2} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 거래대금 + 출처 */}
      <footer className="mt-3 flex items-baseline justify-between border-t border-line pt-2 text-[10px] text-fg-subtle">
        <span>
          24h 거래대금{" "}
          <span className="tabular-nums text-fg-muted">
            {totalVolume > 0
              ? compactFmt(asset === "us" ? "USD" : "KRW").format(totalVolume)
              : "—"}
          </span>
        </span>
        <Link
          href={`/${asset}`}
          className="hover:text-fg"
        >
          {source}
        </Link>
      </footer>
    </article>
  );
}
