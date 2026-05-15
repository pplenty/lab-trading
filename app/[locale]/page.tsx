import {getTranslations} from "next-intl/server";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {AssetClassCard} from "@/components/panels/AssetClassCard";
import {BacktestQuickLinks} from "@/components/panels/BacktestQuickLinks";
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
    fetchQuotes(() => upbitAdapter.listQuotes({limit: 50})),
    fetchQuotes(() => twelveDataAdapter.listQuotes({limit: 50})),
    fetchQuotes(() => kisAdapter.listQuotes({limit: 50})),
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: siteJsonLd(locale)}}
      />

      <header className="mb-10 flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {t("title")}
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
          />
        </div>
      </section>

      <section className="mb-10">
        <BacktestQuickLinks heading="백테스트 빠른 진입" />
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
