import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadComparisonFromCache, type ComparisonRow} from "@/lib/data/backtest-cache";
import {loadIndicatorsForCandles} from "@/lib/data/indicators";
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

// 60s ISR — searchParams 분기 dynamic SSR + 실패 캐시 빠른 회복 (CF Workers cold start 안전망).
export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BacktestNewPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const assetParam = sp.asset;
  const assetClass: AssetClass =
    assetParam === "us" || assetParam === "kr" ? assetParam : "crypto";

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  // strategy + 파라미터 URL prefill (저장된 전략 로드 시).
  const initialStrategyId =
    typeof sp.strategy === "string" ? sp.strategy : undefined;
  const RESERVED_KEYS = new Set(["asset", "symbol", "strategy"]);
  const initialParams: Record<string, number> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (RESERVED_KEYS.has(k)) continue;
    const single = Array.isArray(v) ? v[0] : v;
    if (single === undefined) continue;
    const n = Number(single);
    if (Number.isFinite(n)) initialParams[k] = n;
  }

  const rawSymbol =
    (typeof sp.symbol === "string" ? sp.symbol : undefined) ??
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
      series = await loadCandleSeries({
        asset: "crypto",
        symbol: entry.symbol,
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
      series = await loadCandleSeries({
        asset: "us",
        symbol: entry.symbol,
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
      series = await loadCandleSeries({
        asset: "kr",
        symbol: entry.symbol,
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
  // D1 사전계산 indicators — strategy 가 자체 계산 대신 D1 값 우선 사용 (ADR-0021).
  const indicators = await loadIndicatorsForCandles(symbol, candles);

  // 6 전략 비교 KV cache — hit 면 server-side 즉시 prop, miss 면 null (client 가 채움).
  // SSR cold start 의 6 backtest 비용 회피 (Worker CPU 한도 안전망).
  let comparisonCache: ComparisonRow[] | null = null;
  if (candles.length >= 2) {
    const lastT = candles[candles.length - 1].t;
    comparisonCache = await loadComparisonFromCache(assetClass, symbol, lastT);
  }

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
        <details className="mt-3 rounded-md border border-line bg-surface/40 px-3 py-2 text-xs text-fg-muted">
          <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
            💡 백테스트 처음이라면 — 1분 가이드
          </summary>
          <div className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed text-fg-subtle">
            <p>
              <span className="font-semibold text-fg-muted">백테스트</span> 는 과거 데이터에
              전략을 시뮬레이션해 "이 전략이 지난 N년 동안 어땠을까" 를 측정합니다. 실제
              매매가 아닙니다.
            </p>
            <p>
              <span className="font-semibold text-fg-muted">사용법</span>: ① 아래 카드에서
              전략 선택 → ② 슬라이더로 파라미터 조정 → ③ 결과 카드의 차트·메트릭·
              <span className="text-[var(--color-up)]">▲ 매수</span> /{" "}
              <span className="text-[var(--color-down)]">▼ 매도</span> 사유 확인.
            </p>
            <p>
              <span className="font-semibold text-fg-muted">초보 추천</span>: 먼저{" "}
              <span className="text-fg">매수 후 보유</span> 와 비교해 다른 전략이 의미
              있는지 확인. 단순 보유보다 못하면 그 전략은 이 종목엔 안 맞는 거.
            </p>
          </div>
        </details>
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
          indicators={indicators}
          initialStrategyId={initialStrategyId}
          initialParams={
            Object.keys(initialParams).length > 0 ? initialParams : undefined
          }
          symbolLabel={displayName}
          initialComparison={comparisonCache ?? undefined}
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

