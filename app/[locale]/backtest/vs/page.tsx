import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadIndicatorsForCandles} from "@/lib/data/indicators";
import {toSymbol} from "@/lib/symbols/normalize";
import {
  getCryptoBySymbol,
  getKrBySymbol,
  getUsBySymbol,
} from "@/lib/symbols/registry";
import {getStrategy} from "@/lib/backtest/strategies/registry";
import {VsBacktestPanel} from "@/components/panels/VsBacktestPanel";
import type {AssetClass, Candle} from "@/lib/types";

// 2-strategy 비교 백테스트 — /backtest/vs?asset=us&symbol=aapl&a=sma-cross&b=rsi-reversion
// 같은 종목에 전략 A vs B 결과 side-by-side. 8 preset.

export const revalidate = 60;

const DEFAULT_A = "sma-cross";
const DEFAULT_B = "rsi-reversion";

export const metadata: Metadata = {
  title: "전략 비교 백테스트",
  description: "같은 종목에 두 전략 (A vs B) 을 동시 백테스트해 수익률·MDD·Sharpe 나란히 비교.",
  robots: {index: false},
};

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    asset?: string | string[];
    symbol?: string | string[];
    a?: string | string[];
    b?: string | string[];
  }>;
};

export default async function VsBacktestPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;

  if (sp.asset === undefined && sp.symbol === undefined) {
    redirect(
      `/${locale}/backtest/vs?asset=us&symbol=aapl&a=${DEFAULT_A}&b=${DEFAULT_B}`
    );
  }

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  const assetParam = sp.asset;
  const assetClass: AssetClass =
    assetParam === "us" || assetParam === "kr" ? assetParam : "crypto";

  const rawSymbol =
    (typeof sp.symbol === "string" ? sp.symbol : undefined) ??
    (assetClass === "us" ? "aapl" : assetClass === "kr" ? "005930" : "btc");
  let normalized: string;
  try {
    normalized = toSymbol(rawSymbol, assetClass);
  } catch {
    notFound();
  }

  // 전략 id 검증 — 없으면 default. A==B 면 B 를 다른 걸로.
  const aRaw = typeof sp.a === "string" ? sp.a : DEFAULT_A;
  const bRaw = typeof sp.b === "string" ? sp.b : DEFAULT_B;
  const aId = getStrategy(aRaw) ? aRaw : DEFAULT_A;
  let bId = getStrategy(bRaw) ? bRaw : DEFAULT_B;
  if (bId === aId) bId = aId === "rsi-reversion" ? "sma-cross" : "rsi-reversion";

  let displayName: string;
  let displayTicker: string;
  let currency: string;
  let sourceLabel: string;
  let candles: Candle[] = [];
  let fetchError: string | null = null;

  try {
    if (assetClass === "crypto") {
      const entry = getCryptoBySymbol(normalized);
      if (!entry || !entry.upbitMarket) notFound();
      displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
      displayTicker = entry.symbol.toUpperCase();
      currency = "KRW";
      sourceLabel = "Upbit KRW";
    } else if (assetClass === "us") {
      const entry = getUsBySymbol(normalized);
      if (!entry) notFound();
      displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
      displayTicker = entry.ticker;
      currency = "USD";
      sourceLabel = "Twelve Data";
    } else {
      const entry = getKrBySymbol(normalized);
      if (!entry) notFound();
      displayName = entry.nameKo;
      displayTicker = entry.ticker;
      currency = "KRW";
      sourceLabel = "KIS";
    }
    const series = await loadCandleSeries({
      asset: assetClass,
      symbol: normalized,
      limit: 200,
    });
    candles = series?.candles ?? [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    displayName = normalized;
    displayTicker = normalized.toUpperCase();
    currency = assetClass === "us" ? "USD" : "KRW";
    sourceLabel = "—";
  }

  const indicators = await loadIndicatorsForCandles(normalized, candles);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          {t("backtest")} · 전략 비교
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {displayName} <span className="text-fg-subtle">({displayTicker})</span>{" "}
          · A vs B
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {sourceLabel} · 최근 {candles.length} 봉 · 두 전략을 같은 종목에 동시
          백테스트
        </p>
      </header>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {candles.length >= 2 ? (
        <VsBacktestPanel
          class={assetClass}
          symbol={normalized}
          currency={currency}
          candles={candles}
          indicators={indicators}
          initialA={aId}
          initialB={bId}
        />
      ) : !fetchError ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          백테스트 데이터가 부족합니다.
        </p>
      ) : null}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
        <p className="mt-2">
          단일 전략 + 파라미터 조정은{" "}
          <Link href="/backtest/new" className="underline hover:text-fg">
            /backtest/new
          </Link>
          . 두 전략 모두 default 파라미터로 비교.
        </p>
      </footer>
    </main>
  );
}
