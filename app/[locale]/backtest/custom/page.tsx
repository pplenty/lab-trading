import type {Metadata} from "next";
import {notFound, redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {loadCandleSeries} from "@/lib/data/candles";
import {loadIndicatorsForCandles} from "@/lib/data/indicators";
import {computeIndicators} from "@/lib/backfill/indicators-batch";
import {
  applyTimeframe,
  parseTimeframeParam,
  timeframeLabel,
  TIMEFRAMES,
  type Timeframe,
} from "@/lib/chart/timeframe";
import {toSymbol} from "@/lib/symbols/normalize";
import {
  getCryptoBySymbol,
  getKrBySymbol,
  getUsBySymbol,
} from "@/lib/symbols/registry";
import {CustomBacktestPanel} from "@/components/panels/CustomBacktestPanel";
import type {CustomConfig} from "@/lib/backtest/conditions";
import type {AssetClass, Candle, IndicatorRow} from "@/lib/types";

// 사용자 정의 백테스트 — indicator + AND/OR 조합으로 매수/매도 조건 직접 빌드.
// /backtest/custom?asset=us&symbol=aapl&tf=1d&range=1y

export const dynamic = "force-dynamic";

const TF_FETCH_LIMIT: Record<Timeframe, number> = {
  "1d": 200,
  "1w": 1000,
  "1mo": 1500,
};

export const metadata: Metadata = {
  title: "커스텀 백테스트 — 조건 빌더",
  description:
    "RSI / SMA / MACD 등 26 지표를 AND/OR 로 묶어 매수/매도 조건을 직접 정의하고 백테스트.",
  robots: {index: false},
};

// 기본 config — 사용자가 처음 들어왔을 때 보일 합리적 default.
// "RSI < 30 매수, RSI > 70 매도" (단순 평균 회귀).
const DEFAULT_CONFIG: CustomConfig = {
  buy: {
    op: "AND",
    conditions: [
      {
        left: {kind: "indicator", field: "rsi_14"},
        cmp: "lt",
        right: {kind: "constant", value: 30},
      },
    ],
  },
  sell: {
    op: "OR",
    conditions: [
      {
        left: {kind: "indicator", field: "rsi_14"},
        cmp: "gt",
        right: {kind: "constant", value: 70},
      },
    ],
  },
};

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomBacktestPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;

  if (sp.asset === undefined && sp.symbol === undefined) {
    redirect(`/${locale}/backtest/custom?asset=us&symbol=aapl`);
  }

  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  const assetParam = sp.asset;
  const assetClass: AssetClass =
    assetParam === "us" || assetParam === "kr" ? assetParam : "crypto";
  const tf = parseTimeframeParam(sp.tf);
  const fetchLimit = TF_FETCH_LIMIT[tf];

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
  let rawCandles: Candle[] = [];
  let fetchError: string | null = null;

  try {
    if (assetClass === "crypto") {
      const entry = getCryptoBySymbol(normalized);
      if (!entry || !entry.upbitMarket) notFound();
      displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
      displayTicker = entry.symbol.toUpperCase();
      currency = "KRW";
      sourceLabel = "Upbit KRW";
      const series = await loadCandleSeries({
        asset: "crypto",
        symbol: entry.symbol,
        limit: fetchLimit,
      });
      rawCandles = series?.candles ?? [];
    } else if (assetClass === "us") {
      const entry = getUsBySymbol(normalized);
      if (!entry) notFound();
      displayName = locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
      displayTicker = entry.ticker;
      currency = "USD";
      sourceLabel = "Twelve Data";
      const series = await loadCandleSeries({
        asset: "us",
        symbol: entry.symbol,
        limit: fetchLimit,
      });
      rawCandles = series?.candles ?? [];
    } else {
      const entry = getKrBySymbol(normalized);
      if (!entry) notFound();
      displayName = entry.nameKo;
      displayTicker = entry.ticker;
      currency = "KRW";
      sourceLabel = "KIS";
      const series = await loadCandleSeries({
        asset: "kr",
        symbol: entry.symbol,
        limit: fetchLimit,
      });
      rawCandles = series?.candles ?? [];
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    displayName = normalized;
    displayTicker = normalized.toUpperCase();
    currency = assetClass === "us" ? "USD" : "KRW";
    sourceLabel = "—";
  }

  const candles = applyTimeframe(rawCandles, tf);
  let indicators: IndicatorRow[];
  if (tf === "1d") {
    const loaded = await loadIndicatorsForCandles(normalized, candles);
    indicators = loaded ?? computeIndicators(candles);
  } else {
    indicators = computeIndicators(candles);
  }

  // indicators 와 candles length 강제 동기 — fallback row 채움.
  if (indicators.length !== candles.length) {
    indicators = computeIndicators(candles);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          {t("backtest")} · 커스텀
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {displayName} <span className="text-fg-subtle">({displayTicker})</span>{" "}
          · {timeframeLabel(tf)} 커스텀 백테스트
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span>
            {sourceLabel} · {candles.length} 봉
          </span>
          <CustomTfNav locale={locale} sp={sp} currentTf={tf} />
        </div>
        <details className="mt-3 rounded-md border border-line bg-surface/40 px-3 py-2 text-xs text-fg-muted">
          <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
            💡 커스텀 백테스트란?
          </summary>
          <div className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed text-fg-subtle">
            <p>
              26개 지표 (RSI / SMA / MACD / Bollinger 등) + price (close / open
              / high / low / volume) 를 비교 조건으로 묶어 <span className="font-semibold text-fg-muted">"이런 조건일 때 매수/매도"</span>{" "}
              를 직접 정의합니다.
            </p>
            <p>
              <span className="font-semibold text-fg-muted">사용법</span>: ① 매수 조건
              그룹에 "조건 추가" — 좌변 / 비교 / 우변 → ② AND/OR 토글 → ③ 매도
              조건도 동일 → ④ 결과는 자동 재계산.
            </p>
            <p>
              <span className="font-semibold text-fg-muted">예시</span>: 매수
              "RSI &lt; 30 AND close &gt; sma_50" / 매도 "RSI &gt; 70 OR close &lt; sma_20"
              (강세 추세 안에서 평균 회귀)
            </p>
            <p>
              <span className="font-semibold text-fg-muted">cross_above / cross_below</span>
              {": "}이전 봉 → 현재 봉 사이의 교차 (golden cross 등) 시그널.
            </p>
          </div>
        </details>
      </header>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {candles.length >= 2 ? (
        <CustomBacktestPanel
          class={assetClass}
          symbol={normalized}
          currency={currency}
          candles={candles}
          indicators={indicators}
          initialConfig={DEFAULT_CONFIG}
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
          기존 6 preset 백테스트는{" "}
          <Link href="/backtest/new" className="underline hover:text-fg">
            /backtest/new
          </Link>.
        </p>
      </footer>
    </main>
  );
}

function CustomTfNav({
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
      aria-label="timeframe"
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
            href={`/backtest/custom?${params.toString()}`}
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
