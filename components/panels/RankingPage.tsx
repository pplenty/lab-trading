import {getTranslations} from "next-intl/server";
import type {AssetClass, Quote, RankingKind} from "@/lib/types";
import type {DataAdapter} from "@/lib/adapters/types";
import {QuoteTable} from "./QuoteTable";
import {assetListJsonLd} from "@/lib/seo/asset-list-jsonld";
import {loadRankingsFromD1, loadSparklineCloses} from "@/lib/data/quotes";
import {buildRankingSummary} from "@/lib/market/ranking-summary";

// 자산군 × 랭킹 종류 공용 페이지 컴포넌트.
// 각 자산군의 어댑터 (rankings 구현) 위임 + 실패 시 D1 candles 기반 fallback.

type Props = {
  class: AssetClass;
  kind: RankingKind;
  adapter: DataAdapter;
  locale: string;
  /** name 매핑 — registry 에서 미리 빌드해 전달. */
  nameMap?: Record<string, {name: string; nameKo?: string}>;
  /** 어댑터 식별자 라벨 (footer 데이터 출처 표기용). */
  sourceLabel: string;
  /** registry 의 모든 symbol — adapter.rankings 실패 시 D1 fallback 용. */
  symbols: string[];
};

const KIND_LABEL: Record<RankingKind, {ko: string; en: string}> = {
  gainers: {ko: "상승률 랭킹", en: "Top Gainers"},
  losers: {ko: "하락률 랭킹", en: "Top Losers"},
  volume: {ko: "거래량 랭킹", en: "Top Volume"},
};

export async function RankingPage({
  class: cls,
  kind,
  adapter,
  locale,
  nameMap,
  sourceLabel,
  symbols,
}: Props) {
  const tDisc = await getTranslations("disclaimer");
  const t = await getTranslations("home");

  // D1 우선 — adapter.rankings 의 직렬 호출 (KIS 24 종목 × 100ms sleep) 회피.
  // 인덱스/대시보드 페이지와 동일 트레이드오프: 어제 종가 + 24h 변동.
  // D1 미가용 (신규 종목 / D1 binding X) 시 adapter fallback.
  // limit 20 — top N 만 의미 (사용자 가치) + Workers CPU 한도 안전 (50ms ceiling).
  // 50 종목 quote 빌드 + 50 sparkline SVG path 계산이 1101 trigger 의 한 요소.
  // top 20 으로 줄여 JS compute ~60% 절감.
  const TOP_N = 20;
  let quotes: Quote[] = await loadRankingsFromD1({
    asset: cls,
    symbols,
    kind,
    limit: TOP_N,
  });
  let fetchError: string | null = null;
  if (quotes.length === 0 && adapter.rankings) {
    try {
      quotes = await adapter.rankings(kind, {limit: TOP_N});
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }
  }

  // 7일 sparkline — quotes 가 이미 limit=20 이라 sparkline 도 20개만.
  const visibleSymbols = quotes.map((q) => q.symbol);
  const sparklines = await loadSparklineCloses(visibleSymbols, 7);

  const label = locale === "ko" ? KIND_LABEL[kind].ko : KIND_LABEL[kind].en;
  const assetLabel = locale === "ko" ? t(cls === "crypto" ? "crypto" : cls === "us" ? "us" : "kr") : cls.toUpperCase();

  // 데이터 파생 요약 — h1 + 테이블만이던 thin 랭킹 페이지에 고유 본문(검색 진입).
  const ASSET_KO: Record<AssetClass, string> = {
    crypto: "코인",
    us: "해외주식",
    kr: "국내주식",
  };
  const displayName = (sym: string): string => {
    const meta = nameMap?.[sym];
    if (!meta) return sym.toUpperCase();
    return (
      (locale === "ko" ? meta.nameKo ?? meta.name : meta.name) ||
      sym.toUpperCase()
    );
  };
  const dateStr = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const summary = buildRankingSummary({
    cls,
    kind,
    quotes,
    displayName,
    assetLabel: ASSET_KO[cls],
    dateStr,
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {assetLabel} · {label}
        </h1>
        {summary && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">
            {summary}
          </p>
        )}
      </header>

      {fetchError && (
        <div className="mb-6 rounded-lg border border-line bg-surface p-4 text-sm text-fg-muted">
          <p className="font-medium text-fg">데이터 fetch 실패</p>
          <p className="mt-1 text-xs">{fetchError}</p>
        </div>
      )}

      {quotes.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: assetListJsonLd({
              class: cls,
              locale,
              quotes,
              nameMap,
              listName: `${assetLabel} · ${label}`,
            }),
          }}
        />
      )}

      <QuoteTable
        class={cls}
        quotes={quotes}
        nameMap={nameMap}
        locale={locale}
        sparklines={sparklines}
      />

      <footer className="mt-8 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-2">
          {tDisc("dataSource")}: {sourceLabel} · {new Date().toLocaleString("ko-KR")}
        </p>
      </footer>
    </main>
  );
}
