import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {
  loadCompositeIndex,
  parseCompositeRange,
  compositeRangeLabel,
  COMPOSITE_RANGES,
  type CompositeRange,
} from "@/lib/market/composite-index";
import {FinancialDelta} from "@/components/FinancialDelta";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";

// 자산군별 자체 합성 지수 (equal-weight composite index) — 시계열 차트.
// /ko/indices?range=1y
// crypto / us / kr 3 자산군 같은 base 100 line chart overlay.

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{range?: string | string[]}>;
}): Promise<Metadata> {
  const range = parseCompositeRange((await searchParams).range);
  return {
    title: `자체 지수 — 코인 · 해외주식 · 국내주식 ${compositeRangeLabel(range)}`,
    description:
      "사이트 80 종목 equal-weight composite — 자산군별 시계열 추이. 한 화면에서 시장 분위기 비교.",
    alternates: {canonical: absoluteUrl("/ko/indices")},
  };
}

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{range?: string | string[]}>;
};

const ASSET_LABEL = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
} as const;

// 다크 모드 AA (>=4.5:1 on near-black) + 색맹 robust 팔레트.
// us 는 dash 병행 (색맹 시 색만으로 amber/red 합쳐지는 문제 — dash 로 식별).
const ASSET_COLOR = {
  crypto: "#f59e0b", // amber — 8.93:1
  us: "#3b82f6",     // blue (light #2563eb → dark-adjusted) — 5.21:1
  kr: "#a855f7",     // violet (red 회피 — 색맹 + 한국식 상승색 오해 방지) — 5.5:1
} as const;

const ASSET_DASHED: Record<"crypto" | "us" | "kr", boolean> = {
  crypto: false,
  us: true, // dash — 색맹 시 색 외 추가 식별 채널
  kr: false,
};

export default async function IndicesPage({searchParams}: Props) {
  const sp = await searchParams;
  const range = parseCompositeRange(sp.range);
  const tDisc = await getTranslations("disclaimer");

  const [crypto, us, kr] = await Promise.all([
    loadCompositeIndex("crypto", range),
    loadCompositeIndex("us", range),
    loadCompositeIndex("kr", range),
  ]);

  // overlay 차트용 LineSeries (자산군 무관 같은 base 100 normalized)
  const series: LineSeries[] = [
    {
      label: `${ASSET_LABEL.crypto} (${crypto.barCount}봉)`,
      points: crypto.points.map((p) => ({t: p.t, v: p.v})),
      color: ASSET_COLOR.crypto,
      dashed: ASSET_DASHED.crypto,
    },
    {
      label: `${ASSET_LABEL.us} (${us.barCount}봉)`,
      points: us.points.map((p) => ({t: p.t, v: p.v})),
      color: ASSET_COLOR.us,
      dashed: ASSET_DASHED.us,
    },
    {
      label: `${ASSET_LABEL.kr} (${kr.barCount}봉)`,
      points: kr.points.map((p) => ({t: p.t, v: p.v})),
      color: ASSET_COLOR.kr,
      dashed: ASSET_DASHED.kr,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: "lab-trading 자체 합성 지수 (코인 · 해외주식 · 국내주식)",
            description:
              "사이트 80 종목 equal-weight composite index — 자산군별 일별 시계열. 각 종목 첫 종가를 100 으로 정규화 후 자산군 내 평균.",
            url: absoluteUrl("/ko/indices"),
            creator: {"@type": "Organization", name: "trading.jdgrid.com"},
            variableMeasured: [
              "코인 composite index",
              "해외주식 composite index",
              "국내주식 composite index",
            ],
            temporalCoverage: `${compositeRangeLabel(range)}`,
            license: "https://trading.jdgrid.com/ko",
          }),
        }}
      />
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">시장 지수</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          자체 합성 지수
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          사이트 80 종목 equal-weight composite — 자산군별 시계열 추이를 같은 base
          (100) 으로 정규화해 한 화면 비교. KOSPI / S&P 500 같은 외부 지수와 다르지만,
          본 사이트가 다루는 80 종목의 베로미터.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COMPOSITE_RANGES.map((r) => (
            <RangeChip key={r} range={r} current={range} />
          ))}
        </div>
      </header>

      {/* 통합 overlay 차트 */}
      <section className="mb-6 rounded-lg border border-line bg-surface/30 p-3">
        <header className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {series.map((s, i) => {
              const asset = (["crypto", "us", "kr"] as const)[i];
              const ret =
                asset === "crypto"
                  ? crypto.totalReturnPct
                  : asset === "us"
                  ? us.totalReturnPct
                  : kr.totalReturnPct;
              return (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-4"
                    style={{background: s.color}}
                  />
                  <Link
                    href={`/${asset}`}
                    className="font-medium text-fg hover:text-accent"
                  >
                    {ASSET_LABEL[asset]}
                  </Link>
                  <FinancialDelta changePct={ret} digits={2} />
                </span>
              );
            })}
          </div>
          <span className="text-[10px] text-fg-subtle">
            base 100 normalized · {compositeRangeLabel(range)}
          </span>
        </header>
        <LineChart
          series={series}
          height={320}
          ariaLabel="자산군별 합성 지수 비교 차트"
        />
      </section>

      {/* 자산군 카드 3개 */}
      <section className="grid gap-4 sm:grid-cols-3">
        <AssetCard asset="crypto" idx={crypto} />
        <AssetCard asset="us" idx={us} />
        <AssetCard asset="kr" idx={kr} />
      </section>

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          equal-weight 방식 — 각 종목 첫 봉 close 를 100 으로 정규화 후 자산군 내
          평균. 시총 가중 X · 수익률 기여도 X. 사이트 80 종목 베로미터.
        </p>
      </footer>
    </main>
  );
}

function RangeChip({
  range,
  current,
}: {
  range: CompositeRange;
  current: CompositeRange;
}) {
  const active = range === current;
  return (
    <Link
      href={`/indices?range=${range}`}
      scroll={false}
      className={
        active
          ? "rounded-md bg-fg px-3 py-1 text-[11px] font-medium text-bg"
          : "rounded-md border border-line bg-bg px-3 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
      }
    >
      {compositeRangeLabel(range)}
    </Link>
  );
}

function AssetCard({
  asset,
  idx,
}: {
  asset: "crypto" | "us" | "kr";
  idx: ReturnType<typeof loadCompositeIndex> extends Promise<infer R> ? R : never;
}) {
  const color = ASSET_COLOR[asset];
  return (
    <article className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <Link
          href={`/${asset}`}
          className="text-sm font-semibold text-fg hover:text-accent"
        >
          {ASSET_LABEL[asset]}
        </Link>
        <FinancialDelta changePct={idx.totalReturnPct} digits={2} />
      </header>
      <div className="mb-2">
        <LineChart
          series={[
            {
              label: ASSET_LABEL[asset],
              points: idx.points.map((p) => ({t: p.t, v: p.v})),
              color,
            },
          ]}
          height={120}
          ariaLabel={`${ASSET_LABEL[asset]} 합성 지수 추이`}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-fg-subtle">종목 수</dt>
        <dd className="text-right tabular-nums text-fg-muted">
          {idx.totalSymbols}
        </dd>
        <dt className="text-fg-subtle">봉 수</dt>
        <dd className="text-right tabular-nums text-fg-muted">{idx.barCount}</dd>
        <dt className="text-fg-subtle">시작</dt>
        <dd className="text-right tabular-nums text-fg-muted">
          {idx.firstT ? new Date(idx.firstT * 1000).toLocaleDateString("ko-KR") : "—"}
        </dd>
        <dt className="text-fg-subtle">종료</dt>
        <dd className="text-right tabular-nums text-fg-muted">
          {idx.lastT ? new Date(idx.lastT * 1000).toLocaleDateString("ko-KR") : "—"}
        </dd>
      </dl>
    </article>
  );
}
