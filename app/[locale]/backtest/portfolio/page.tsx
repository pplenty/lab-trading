import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {loadCandleSeries} from "@/lib/data/candles";
import {
  getCryptoBySymbol,
  getKrBySymbol,
  getUsBySymbol,
} from "@/lib/symbols/registry";
import {parseRangeParam, rangeBars, rangeLabel} from "@/lib/chart/range";
import {parseCompareToken} from "@/lib/compare/normalize";
import {ChartRangeToggle} from "@/components/charts/ChartRangeToggle";
import {PortfolioBacktestPanel} from "@/components/panels/PortfolioBacktestPanel";
import type {AssetClass, Candle} from "@/lib/types";

// 다중 종목 포트폴리오 백테스트 (ADR-0019 1차 출시 확장).
// /backtest/portfolio?symbols=us:aapl,us:tsla,crypto:btc&weights=40,30,30&range=1y
// max 4 종목. 단일 종목 백테스트 (/backtest/new) 와 별개.

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{symbols?: string | string[]}>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = typeof sp.symbols === "string" ? sp.symbols : "";
  return {
    title: raw ? `포트폴리오 백테스트 — ${raw}` : "포트폴리오 백테스트",
    description:
      "여러 종목을 비중대로 배분해 과거 데이터로 시뮬레이션. 코인 · 해외주식 · 국내주식 mixed.",
    robots: {index: false}, // 인터랙티브 페이지 — 검색 X
  };
}

function labelFor(cls: AssetClass, symbol: string, locale: string): string | null {
  if (cls === "crypto") {
    const e = getCryptoBySymbol(symbol);
    if (!e || !e.upbitMarket) return null;
    return locale === "ko" && e.nameKo ? e.nameKo : e.name;
  }
  if (cls === "us") {
    const e = getUsBySymbol(symbol);
    if (!e) return null;
    return locale === "ko" && e.nameKo ? e.nameKo : e.name;
  }
  const e = getKrBySymbol(symbol);
  if (!e) return null;
  return e.nameKo;
}

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    symbols?: string | string[];
    weights?: string | string[];
    range?: string | string[];
  }>;
};

export default async function PortfolioBacktestPage({
  params,
  searchParams,
}: Props) {
  const {locale} = await params;
  const sp = await searchParams;

  // 빈 URL → default mixed 3 종목 (BTC + AAPL + 삼성전자) equal weight
  if (sp.symbols === undefined) {
    redirect(
      `/${locale}/backtest/portfolio?symbols=crypto:btc,us:aapl,kr:005930&range=1y`
    );
  }

  const tDisc = await getTranslations("disclaimer");
  const range = parseRangeParam(sp.range);
  const bars = rangeBars(range);

  const rawSymbols = typeof sp.symbols === "string" ? sp.symbols : "";
  const tokens = rawSymbols
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);

  // weights query — "40,30,30" → [0.4, 0.3, 0.3]. 미지정 시 균등.
  const rawWeights = typeof sp.weights === "string" ? sp.weights : "";
  const weightNums = rawWeights
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  type LoadedPosition = {
    class: AssetClass;
    symbol: string;
    label: string;
    weight: number;
    candles: Candle[];
  };

  const positions: LoadedPosition[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const parsed = parseCompareToken(tokens[i]);
    if (!parsed) continue;
    const label = labelFor(parsed.class, parsed.symbol, locale);
    if (!label) continue;
    try {
      const series = await loadCandleSeries({
        asset: parsed.class,
        symbol: parsed.symbol,
        limit: bars,
      });
      if (!series || series.candles.length < 2) continue;
      positions.push({
        class: parsed.class,
        symbol: parsed.symbol,
        label,
        // 균등 또는 query weight (0-1 로 normalize)
        weight: weightNums[i] !== undefined ? weightNums[i] / 100 : 1 / tokens.length,
        candles: series.candles,
      });
    } catch {
      continue;
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-fg-subtle">
            백테스트 · 포트폴리오
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            포트폴리오 백테스트
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            여러 종목을 비중대로 배분해 과거 데이터로 시뮬레이션 ·{" "}
            {rangeLabel(range)} ({bars} 봉)
          </p>
        </div>
        <ChartRangeToggle
          basePath={`/backtest/portfolio?symbols=${rawSymbols}`}
          current={range}
        />
      </header>

      <details className="mb-4 rounded-md border border-line bg-surface/40 px-3 py-2 text-xs text-fg-muted">
        <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
          💡 처음이라면 — 1분 가이드
        </summary>
        <div className="mt-2 flex flex-col gap-1.5 text-[12px] leading-relaxed text-fg-subtle">
          <p>
            <span className="font-semibold text-fg-muted">포트폴리오 백테스트</span>{" "}
            는 여러 종목에 비중을 두고 분산투자했을 때 결과를 측정합니다.
          </p>
          <p>
            <span className="font-semibold text-fg-muted">사용법</span>: ① 슬라이더로
            각 종목 비중 조정 → ② 결과 카드의 수익률 · MDD · 자산별 기여도 확인 →
            ③ "균등 배분" 비교로 가중치 효과 검증.
          </p>
          <p>
            <span className="font-semibold text-fg-muted">모델</span>: 첫 시점 매수
            후 끝까지 보유 (Buy &amp; Hold). 주기적 rebalance 는 다음 라운드.
            수수료 0.1% · 슬리피지 0.05%.
          </p>
        </div>
      </details>

      {positions.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center">
          <p className="text-sm font-medium text-fg">종목 데이터를 가져올 수 없습니다</p>
          <p className="mt-2 text-xs text-fg-muted">
            URL 파라미터:{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px]">
              ?symbols=us:aapl,us:tsla,crypto:btc&amp;range=1y
            </code>
          </p>
          <Link
            href="/backtest/portfolio?symbols=crypto:btc,us:aapl,kr:005930&range=1y"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
          >
            default 포트폴리오 시도 →
          </Link>
        </div>
      ) : (
        <PortfolioBacktestPanel
          key={positions.map((p) => `${p.class}:${p.symbol}`).join(",")}
          initialPositions={positions}
          range={range}
        />
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
      </footer>
    </main>
  );
}
