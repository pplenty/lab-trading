import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound, redirect} from "next/navigation";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
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
import {
  applyTimeframe,
  parseTimeframeParam,
  timeframeLabel,
} from "@/lib/chart/timeframe";
import {computeIndicators} from "@/lib/backfill/indicators-batch";
import type {AssetClass, Candle, CandleSeries, IndicatorRow} from "@/lib/types";

// 주봉/월봉 backtest 시 의미 있는 봉 수 확보 위해 일봉 fetch 윈도우 확장.
const TF_FETCH_LIMIT = {"1d": 200, "1w": 1000, "1mo": 1500} as const;

// 백테스트 작업장 — `/backtest/new?asset=crypto&symbol=btc` URL params 로 종목 prefill.
// 활성: crypto (Upbit KRW 라이브) + us (Twelve Data) + kr (KIS). us / kr 은 키 미발급 시 demo GBM 자동 분기.
// candles 는 server (RSC) 가 fetch 해 BacktestPanel client 컴포넌트로 전달 (ADR-0019).

// canonical 은 params 무관 bare URL — ?asset=&symbol= 변형이 중복 색인되지 않도록.
export const metadata: Metadata = {
  title: "일봉 백테스트",
  description:
    "전략을 일봉으로 검증 — 수익률 · MDD · Sharpe · Profit Factor. 6 프리셋 + 커스텀 AND/OR 조건.",
  alternates: {canonical: absoluteUrl("/ko/backtest/new")},
  openGraph: {
    title: "일봉 백테스트",
    description:
      "전략을 일봉으로 검증 — 수익률 · MDD · Sharpe. 6 프리셋 + 커스텀 AND/OR 조건.",
    url: absoluteUrl("/ko/backtest/new"),
    siteName: "trading",
    locale: "ko",
    type: "website",
    images: [
      {
        url: absoluteUrl("/og/backtest.png"),
        width: 1200,
        height: 630,
        alt: "일봉 백테스트",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [absoluteUrl("/og/backtest.png")],
  },
};

// 60s ISR — searchParams 분기 dynamic SSR + 실패 캐시 빠른 회복 (CF Workers cold start 안전망).
export const revalidate = 60;

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BacktestNewPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;

  // 빈 URL (asset/symbol 없음) → default 종목 명시 URL 로 redirect.
  // Next 16 + opennextjs/cloudflare 의 ISR cache + catch-all 라우팅 mismatch 우회
  // (빈 searchParams 가 catch-all 로 잘못 매칭돼 404 stuck cache 패턴).
  if (sp.asset === undefined && sp.symbol === undefined) {
    redirect(`/${locale}/backtest/new?asset=crypto&symbol=btc`);
  }

  const assetParam = sp.asset;
  const assetClass: AssetClass =
    assetParam === "us" || assetParam === "kr" ? assetParam : "crypto";
  const tf = parseTimeframeParam(sp.tf);
  const fetchLimit = TF_FETCH_LIMIT[tf];

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  // strategy + 파라미터 URL prefill (저장된 전략 로드 시).
  const initialStrategyId =
    typeof sp.strategy === "string" ? sp.strategy : undefined;
  const RESERVED_KEYS = new Set(["asset", "symbol", "strategy", "tf"]);
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
        limit: fetchLimit,
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
        limit: fetchLimit,
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
        limit: fetchLimit,
      });
      isDemo = series.source.includes("demo");
      sourceLabel = isDemo ? "KIS (demo)" : "한국투자증권 (KIS)";
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      sourceLabel = "KIS";
    }
  }

  const rawCandles: Candle[] = series?.candles ?? [];
  // tf !== "1d" 면 일봉을 주/월봉으로 aggregate (ADR-0019 1w/1mo 옵션).
  const candles: Candle[] = applyTimeframe(rawCandles, tf);
  const symbol = normalized;
  // tf === "1d": D1 사전계산 indicators 우선 (ADR-0021).
  // tf !== "1d": aggregate 한 봉 기준으로 indicators 재계산 (D1 는 일봉만 저장).
  let indicators: IndicatorRow[] | undefined;
  if (tf === "1d") {
    indicators = await loadIndicatorsForCandles(symbol, candles);
  } else {
    indicators = computeIndicators(candles);
  }

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
          · {timeframeLabel(tf)} 백테스트
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span>
            {sourceLabel} · 최근 {candles.length} 봉
          </span>
          <TfNav locale={locale} sp={sp} currentTf={tf} />
        </div>
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
        <div className="mt-2 text-[11px] text-fg-subtle">
          기성 6 preset 이 모자라면 →{" "}
          <Link
            href={`/backtest/custom?asset=${assetClass}&symbol=${symbol}`}
            className="font-medium text-fg-muted underline hover:text-fg"
          >
            🧪 커스텀 조건 빌더
          </Link>
          {" "}로 AND/OR 직접 정의
        </div>
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
          tf={tf}
          displayName={displayName}
          displayTicker={displayTicker}
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

import {TIMEFRAMES, type Timeframe} from "@/lib/chart/timeframe";

// 백테스트 페이지의 timeframe segmented control — 다른 query 보존.
function TfNav({
  locale: _locale,
  sp,
  currentTf,
}: {
  locale: string;
  sp: Record<string, string | string[] | undefined>;
  currentTf: Timeframe;
}) {
  void _locale;
  return (
    <div
      role="tablist"
      aria-label="백테스트 timeframe"
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface/40 p-0.5"
    >
      {TIMEFRAMES.map((tfOpt) => {
        const active = tfOpt === currentTf;
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(sp)) {
          if (k === "tf") continue;
          const s = Array.isArray(v) ? v[0] : v;
          if (s !== undefined) params.set(k, s);
        }
        if (tfOpt !== "1d") params.set("tf", tfOpt);
        const label = tfOpt === "1d" ? "일봉" : tfOpt === "1w" ? "주봉" : "월봉";
        return (
          <Link
            key={tfOpt}
            href={`/backtest/new?${params.toString()}`}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={`min-w-[44px] rounded px-2 py-1 text-center text-[11px] font-medium tabular-nums transition-colors ${
              active
                ? "bg-fg text-bg"
                : "text-fg-muted hover:bg-surface hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

