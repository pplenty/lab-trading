import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {toSymbol} from "@/lib/symbols/normalize";
import {getCryptoBySymbol} from "@/lib/symbols/registry";
import {BacktestPanel} from "@/components/panels/BacktestPanel";
import type {Candle, CandleSeries} from "@/lib/types";

// 백테스트 작업장 — `/backtest/new?asset=crypto&symbol=btc` URL params 로 종목 prefill.
// 1차 출시는 코인만 활성 (Upbit KRW). 미장은 Twelve Data 키 발급 후 활성.
// candles 는 server (RSC) 가 fetch 해 BacktestPanel client 컴포넌트로 전달 (ADR-0019).

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{asset?: string; symbol?: string}>;
};

export default async function BacktestNewPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const assetClass = sp.asset === "us" || sp.asset === "kr" ? sp.asset : "crypto";
  const rawSymbol = sp.symbol ?? "btc";

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  if (assetClass !== "crypto") {
    // 1차 출시는 crypto 만 — us / kr 은 stub.
    return <StubMessage assetLabel={assetClass === "us" ? "해외주식" : "국내주식"} />;
  }

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

  let series: CandleSeries | null = null;
  let fetchError: string | null = null;
  try {
    series = await upbitAdapter.getCandles(entry.symbol, {
      timeframe: "1d",
      limit: 200,
    });
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const candles: Candle[] = series?.candles ?? [];
  const displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          {t("backtest")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {displayName}{" "}
          <span className="text-fg-subtle">({entry.symbol.toUpperCase()})</span>{" "}
          · 일봉 백테스트
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Upbit KRW · 최근 {candles.length} 봉
        </p>
      </header>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {candles.length >= 2 ? (
        <BacktestPanel
          symbol={entry.symbol}
          class="crypto"
          currency="KRW"
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
          {tDisc("dataSource")}: Upbit · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}

function StubMessage({assetLabel}: {assetLabel: string}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {assetLabel} 백테스트
      </h1>
      <p className="mt-3 text-sm text-fg-muted">
        해외주식 / 국내주식 백테스트는 데이터 어댑터 키 발급 후 활성화됩니다 (Twelve Data / KIS API).
        현재는 코인만 점등되어 있습니다.
      </p>
    </main>
  );
}
