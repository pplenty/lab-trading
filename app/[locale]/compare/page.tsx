import type {Metadata} from "next";
import nextDynamic from "next/dynamic";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {loadCandleSeries} from "@/lib/data/candles";
import {
  cryptoRegistry,
  getCryptoBySymbol,
  getKrBySymbol,
  getUsBySymbol,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {parseRangeParam, rangeBars, rangeLabel} from "@/lib/chart/range";
import {parseCompareToken, normalizeForCompare, type CompareEntry} from "@/lib/compare/normalize";
import {ChartRangeToggle} from "@/components/charts/ChartRangeToggle";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {AssetClass} from "@/lib/types";

const MultiSeriesChart = nextDynamic(() =>
  import("@/components/charts/MultiSeriesChart").then((m) => m.MultiSeriesChart)
);

// 다중 종목 비교 차트 페이지.
// /compare?symbols=us:aapl,us:tsla,crypto:btc&range=1y
// 4 종목까지. normalized (첫 봉 = 100) line chart + 메트릭 비교 표.

export const revalidate = 300;

// 시각 가독성 위한 4종 색 — 자산군 무관, 순서 fixed.
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04"]; // blue / red / green / amber

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

function tickerFor(cls: AssetClass, symbol: string): string {
  if (cls === "crypto") return symbol.toUpperCase();
  if (cls === "us") return getUsBySymbol(symbol)?.ticker ?? symbol.toUpperCase();
  return symbol; // kr — 6자리 코드
}

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{
    symbols?: string | string[];
    range?: string | string[];
  }>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{symbols?: string | string[]}>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = typeof sp.symbols === "string" ? sp.symbols : "";
  return {
    title: raw ? `종목 비교 — ${raw}` : "종목 비교 차트",
    description:
      "코인 · 해외주식 · 국내주식 종목을 같은 차트에서 normalized (100 기준) 추세 비교. 일봉.",
    robots: {index: !!raw},
  };
}

export default async function ComparePage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const tDisc = await getTranslations("disclaimer");

  const range = parseRangeParam(sp.range);
  const bars = rangeBars(range);

  // symbols token parse
  const rawSymbols = typeof sp.symbols === "string" ? sp.symbols : "";
  const tokens = rawSymbols
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 4); // max 4

  // 종목 entry 빌드
  const entries: CompareEntry[] = [];
  for (const t of tokens) {
    const parsed = parseCompareToken(t);
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
      entries.push({
        class: parsed.class,
        symbol: parsed.symbol,
        label,
        candles: series.candles,
      });
    } catch {
      continue;
    }
  }

  const series = normalizeForCompare(entries);

  // suggestion — 사용자가 빈 페이지 또는 1개만 진입 시
  const suggestions = [
    {label: "AAPL · TSLA · NVDA", q: "us:aapl,us:tsla,us:nvda"},
    {label: "BTC · ETH · SOL", q: "crypto:btc,crypto:eth,crypto:sol"},
    {label: "삼성전자 · SK하이닉스 · NAVER", q: "kr:005930,kr:000660,kr:035420"},
    {label: "BTC · AAPL · 삼성전자", q: "crypto:btc,us:aapl,kr:005930"},
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">비교 차트</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          종목 비교
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          코인 · 해외주식 · 국내주식 — 같은 차트에서 normalized (100 기준) 추세 비교
        </p>
      </header>

      {entries.length === 0 ? (
        <section className="rounded-lg border border-line bg-surface/40 p-8">
          <p className="text-sm font-medium text-fg">
            비교할 종목을 선택하세요 (최대 4개)
          </p>
          <p className="mt-2 text-xs text-fg-muted">
            URL 파라미터:{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px]">
              ?symbols=us:aapl,us:tsla,crypto:btc&amp;range=1y
            </code>
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {suggestions.map((s) => (
              <Link
                key={s.q}
                href={`/compare?symbols=${s.q}&range=1y`}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2 text-sm transition-colors hover:border-fg"
              >
                <span className="truncate font-medium text-fg">{s.label}</span>
                <span className="text-[11px] text-fg-subtle">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* 범례 + range toggle */}
          <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {series.map((s, i) => (
                <span
                  key={`${s.entry.class}:${s.entry.symbol}`}
                  className="inline-flex items-center gap-1.5 text-fg-muted"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-4"
                    style={{background: COLORS[i % COLORS.length]}}
                  />
                  <Link
                    href={`/${s.entry.class}/${s.entry.symbol}`}
                    className="font-medium text-fg hover:text-accent"
                  >
                    {s.entry.label}
                  </Link>
                  <span className="text-fg-subtle">
                    {tickerFor(s.entry.class, s.entry.symbol)}
                  </span>
                </span>
              ))}
            </div>
            <ChartRangeToggle
              basePath={`/compare?symbols=${rawSymbols}`}
              current={range}
            />
          </section>

          {/* 차트 */}
          <section className="mb-6 rounded-lg border border-line bg-surface/30 p-3">
            <MultiSeriesChart
              height={420}
              lines={series.map((s, i) => ({
                label: s.entry.label,
                points: s.points,
                color: COLORS[i % COLORS.length],
              }))}
            />
            <p className="mt-2 text-[10px] text-fg-subtle">
              normalized · 첫 봉 종가 = 100 기준. {rangeLabel(range)} (최근{" "}
              {bars} 봉)
            </p>
          </section>

          {/* 메트릭 비교 표 */}
          <section className="mb-6 overflow-hidden rounded-lg border border-line">
            <div className="border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
              기간 메트릭 비교
            </div>
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">종목</th>
                  <th className="px-4 py-2 text-right font-medium">
                    총 수익률
                  </th>
                  <th className="px-4 py-2 text-right font-medium">MDD</th>
                  <th className="px-4 py-2 text-right font-medium">봉 수</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s, i) => (
                  <tr
                    key={`${s.entry.class}:${s.entry.symbol}`}
                    className="border-t border-line"
                  >
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2 w-2 rounded-full"
                          style={{background: COLORS[i % COLORS.length]}}
                        />
                        <Link
                          href={`/${s.entry.class}/${s.entry.symbol}`}
                          className="font-medium text-fg hover:text-accent"
                        >
                          {s.entry.label}
                        </Link>
                        <span className="text-xs text-fg-subtle">
                          {tickerFor(s.entry.class, s.entry.symbol)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {s.totalReturnPct === null ? (
                        "—"
                      ) : (
                        <FinancialDelta changePct={s.totalReturnPct} digits={2} />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-fg-muted">
                      {s.mddPct === null
                        ? "—"
                        : `-${s.mddPct.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-fg-subtle">
                      {s.entry.candles.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 추가 비교 suggestion */}
          <section className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
              다른 조합 시도
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Link
                  key={s.q}
                  href={`/compare?symbols=${s.q}&range=${range}`}
                  className="rounded-md border border-line bg-bg px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          데이터: Upbit · Twelve Data · KIS · D1 historical
        </p>
      </footer>
    </main>
  );
}

// helper — registry getter (lazy ref to avoid breaking tree shake)
void cryptoRegistry;
void usRegistry;
void krRegistry;
