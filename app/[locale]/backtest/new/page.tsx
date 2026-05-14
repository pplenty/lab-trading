import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import {toSymbol} from "@/lib/symbols/normalize";
import {
  getCryptoBySymbol,
  getKrBySymbol,
  getUsBySymbol,
} from "@/lib/symbols/registry";
import {BacktestPanel} from "@/components/panels/BacktestPanel";
import type {AssetClass, Candle, CandleSeries} from "@/lib/types";

// 백테스트 작업장 — `/backtest/new?asset=crypto&symbol=btc` URL params 로 종목 prefill.
// 활성: crypto (Upbit KRW 라이브) + us (Twelve Data) + kr (KIS). us / kr 은 키 미발급 시 demo GBM 자동 분기.
// candles 는 server (RSC) 가 fetch 해 BacktestPanel client 컴포넌트로 전달 (ADR-0019).

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{asset?: string; symbol?: string}>;
};

export default async function BacktestNewPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const assetClass: AssetClass =
    sp.asset === "us" || sp.asset === "kr" ? sp.asset : "crypto";

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  const rawSymbol =
    sp.symbol ??
    (assetClass === "us" ? "aapl" : assetClass === "kr" ? "005930" : "btc");
  let normalized: string;
  try {
    normalized = toSymbol(rawSymbol, assetClass);
  } catch {
    notFound();
  }

  let displayName: string;
  let displayTicker: string;
  let currency: string;
  let sourceLabel: string;
  let series: CandleSeries | null = null;
  let fetchError: string | null = null;
  let isDemo = false;

  if (assetClass === "crypto") {
    const entry = getCryptoBySymbol(normalized);
    if (!entry || !entry.upbitMarket) notFound();
    displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
    displayTicker = entry.symbol.toUpperCase();
    currency = "KRW";
    sourceLabel = "Upbit KRW";
    try {
      series = await upbitAdapter.getCandles(entry.symbol, {
        timeframe: "1d",
        limit: 200,
      });
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
  } else if (assetClass === "us") {
    const entry = getUsBySymbol(normalized);
    if (!entry) notFound();
    displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
    displayTicker = entry.ticker;
    currency = "USD";
    try {
      series = await twelveDataAdapter.getCandles(entry.symbol, {
        timeframe: "1d",
        limit: 200,
      });
      isDemo = series.source.includes("demo");
      sourceLabel = isDemo ? "Twelve Data (demo)" : "Twelve Data";
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      sourceLabel = "Twelve Data";
    }
  } else {
    // kr
    const entry = getKrBySymbol(normalized);
    if (!entry) notFound();
    displayName = entry.nameKo;
    displayTicker = entry.ticker;
    currency = "KRW";
    try {
      series = await kisAdapter.getCandles(entry.symbol, {
        timeframe: "1d",
        limit: 200,
      });
      isDemo = series.source.includes("demo");
      sourceLabel = isDemo ? "KIS (demo)" : "한국투자증권 (KIS)";
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      sourceLabel = "KIS";
    }
  }

  const candles: Candle[] = series?.candles ?? [];
  const symbol = normalized;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          {t("backtest")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {displayName} <span className="text-fg-subtle">({displayTicker})</span>{" "}
          · 일봉 백테스트
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {sourceLabel} · 최근 {candles.length} 봉
        </p>
      </header>

      {isDemo && (
        <div className="mb-4 rounded-md border border-line bg-surface/40 px-3 py-2 text-[11px] text-fg-muted">
          ⚠️ Demo data — {assetClass === "us" ? "Twelve Data" : "KIS"} API 키 미발급
          상태. 가격은 deterministic GBM 시뮬레이션입니다 (시연 / 백테스트 검증용).
        </div>
      )}

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {candles.length >= 2 ? (
        <BacktestPanel
          symbol={symbol}
          class={assetClass}
          currency={currency}
          candles={candles}
        />
      ) : !fetchError ? (
        <p className="rounded-md border border-line bg-surface p-4 text-sm text-fg-muted">
          백테스트를 실행할 데이터가 부족합니다.
        </p>
      ) : null}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: {sourceLabel} ·{" "}
          {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}

