import {getTranslations} from "next-intl/server";
import {loadQuotesList, loadSparklineCloses} from "@/lib/data/quotes";

// 5분 ISR — Next.js 가 HTML 자체 캐시. 같은 worker 인스턴스 fast path.
// quotes 갱신 주기 (cron 5분) 와 동기화.
export const revalidate = 300;
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {AssetClassCard} from "@/components/panels/AssetClassCard";
import {BacktestQuickLinks} from "@/components/panels/BacktestQuickLinks";
import {Link} from "@/i18n/navigation";
import {BrandMark} from "@/components/BrandMark";
import {siteJsonLd} from "@/lib/seo/site-jsonld";
import type {Quote} from "@/lib/types";

// 대시보드 / 홈 — 3 자산군 통합 첫 진입 화면.
// 각 자산군 어댑터 listQuotes 병렬 호출 → top gainers/losers 3 + 백테스트 빠른 진입.
// 한 자산군이 실패해도 나머지는 노출 (Promise.allSettled).

async function fetchQuotes(
  loader: () => Promise<Quote[]>
): Promise<{quotes: Quote[]; error: string | null}> {
  try {
    const quotes = await loader();
    return {quotes, error: null};
  } catch (err) {
    return {quotes: [], error: err instanceof Error ? err.message : String(err)};
  }
}

export default async function HomePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  const [crypto, us, kr] = await Promise.all([
    fetchQuotes(() =>
      loadQuotesList({
        asset: "crypto",
        symbols: cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol),
        listOpts: {limit: 50},
      })
    ),
    fetchQuotes(() =>
      loadQuotesList({
        asset: "us",
        symbols: usRegistry.map((e) => e.symbol),
        listOpts: {limit: 50},
      })
    ),
    fetchQuotes(() =>
      loadQuotesList({
        asset: "kr",
        symbols: krRegistry.map((e) => e.symbol),
        listOpts: {limit: 50},
      })
    ),
  ]);

  const cryptoNameMap = Object.fromEntries(
    cryptoRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  const usNameMap = Object.fromEntries(
    usRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );
  const krNameMap = Object.fromEntries(
    krRegistry.map((e) => [e.symbol, {name: e.name, nameKo: e.nameKo}])
  );

  const cryptoDemo = crypto.quotes[0]?.source.includes("demo") ?? false;
  const usDemo = us.quotes[0]?.source.includes("demo") ?? true;
  const krDemo = kr.quotes[0]?.source.includes("demo") ?? true;

  // 7일 sparkline — top mover 6 종목 × 3 자산군 = 18. 1 query 각.
  const topSymbols = (qs: typeof crypto.quotes) => {
    const sorted = [...qs].sort(
      (a, b) => (b.changePct24h ?? 0) - (a.changePct24h ?? 0)
    );
    return [...sorted.slice(0, 3), ...sorted.slice(-3)].map((q) => q.symbol);
  };
  const [cryptoSparks, usSparks, krSparks] = await Promise.all([
    loadSparklineCloses(topSymbols(crypto.quotes), 7),
    loadSparklineCloses(topSymbols(us.quotes), 7),
    loadSparklineCloses(topSymbols(kr.quotes), 7),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: siteJsonLd(locale)}}
      />

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          <BrandMark size={32} className="shrink-0 text-fg-muted" />
          <span>{t("title")}</span>
        </h1>
        <p className="max-w-2xl text-base text-fg-muted">{t("subtitle")}</p>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {t("assetClasses")}
          </h2>
          <p className="text-[11px] text-fg-subtle">24h ▲▼ Top 3</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <AssetClassCard
            class="crypto"
            title={t("crypto")}
            href="/crypto"
            quotes={crypto.quotes}
            nameMap={cryptoNameMap}
            locale={locale}
            sourceLabel="Upbit · KRW"
            isDemo={cryptoDemo}
            fetchError={crypto.error}
            sparklines={cryptoSparks}
          />
          <AssetClassCard
            class="us"
            title={t("us")}
            href="/us"
            quotes={us.quotes}
            nameMap={usNameMap}
            locale={locale}
            sourceLabel="Twelve Data · USD"
            isDemo={usDemo}
            fetchError={us.error}
            sparklines={usSparks}
          />
          <AssetClassCard
            class="kr"
            title={t("kr").replace(" (Phase 1.5)", "")}
            href="/kr"
            quotes={kr.quotes}
            nameMap={krNameMap}
            locale={locale}
            sourceLabel="KIS · KRW"
            isDemo={krDemo}
            fetchError={kr.error}
            sparklines={krSparks}
          />
        </div>
      </section>

      <section className="mb-10">
        <BacktestQuickLinks heading="백테스트 빠른 진입" />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          더 보기
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/market"
            className="group rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
          >
            <p className="text-sm font-semibold text-fg group-hover:text-accent">
              📊 시장 분위기
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              자산군 × 80 종목 24h 변동 분포 + Top movers
            </p>
          </Link>
          <Link
            href="/compare"
            className="group rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
          >
            <p className="text-sm font-semibold text-fg group-hover:text-accent">
              ⇆ 비교 차트
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              여러 종목 normalized 추세 비교 (4종목까지)
            </p>
          </Link>
          <Link
            href="/backtest/portfolio"
            className="group rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
          >
            <p className="text-sm font-semibold text-fg group-hover:text-accent">
              💼 포트폴리오 백테스트
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              여러 종목 비중 배분 시뮬레이션
            </p>
          </Link>
          <Link
            href="/alerts"
            className="group rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
          >
            <p className="text-sm font-semibold text-fg group-hover:text-accent">
              🔔 가격 알림
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              조건 도달 시 자동 감지 · localStorage
            </p>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: Upbit / Twelve Data / KIS · {" "}
          {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
