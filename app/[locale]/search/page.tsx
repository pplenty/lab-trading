import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Search} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {searchAssets} from "@/lib/search";
import {loadQuotesFromD1, loadSparklineCloses} from "@/lib/data/quotes";
import {FinancialDelta} from "@/components/FinancialDelta";
import {Sparkline} from "@/components/charts/Sparkline";
import type {AssetClass, Quote} from "@/lib/types";

// 통합 검색 결과 페이지 — `/<locale>/search?q=...`.
// 헤더의 SearchBox listbox 는 빠른 진입용. 본 페이지는:
//   - URL share / 북마크 / 외부 진입 (검색엔진 sitelinks searchbox 의 target)
//   - 결과 다수 + 가격 + 7일 sparkline + 자산군 그룹

type Props = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{q?: string | string[]}>;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{q?: string | string[]}>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : Array.isArray(sp.q) ? sp.q[0] : "";
  return {
    title: q ? `"${q}" 검색 결과` : "종목 검색",
    description: q
      ? `${q} 관련 코인 · 해외주식 · 국내주식 검색 결과.`
      : "코인 · 해외주식 · 국내주식 통합 검색.",
    robots: {index: false},
  };
}

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

const ASSET_PRIORITY: AssetClass[] = ["crypto", "us", "kr"];

function priceFmt(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  });
}

export default async function SearchPage({params, searchParams}: Props) {
  const {locale} = await params;
  const sp = await searchParams;
  const q =
    typeof sp.q === "string"
      ? sp.q
      : Array.isArray(sp.q)
      ? sp.q[0] ?? ""
      : "";

  const tDisc = await getTranslations("disclaimer");
  const results = q.trim().length > 0 ? searchAssets(q, 50) : [];

  // 자산군별 quote + sparkline batch fetch — D1 우선, 비용 최소
  const byClass = new Map<AssetClass, string[]>();
  for (const r of results) {
    const arr = byClass.get(r.class) ?? [];
    arr.push(r.symbol);
    byClass.set(r.class, arr);
  }
  const [quoteResults, sparkResults] = await Promise.all([
    Promise.all(
      Array.from(byClass.entries()).map(async ([cls, syms]) => {
        const qs = await loadQuotesFromD1(cls, syms);
        return [cls, qs] as const;
      })
    ),
    loadSparklineCloses(results.map((r) => r.symbol), 7),
  ]);
  const quoteMap = new Map<string, Quote>();
  for (const [, qs] of quoteResults) {
    for (const qu of qs) quoteMap.set(`${qu.class}:${qu.symbol}`, qu);
  }

  // 자산군 그룹화 (결과 많은 순)
  const groups = ASSET_PRIORITY.map((cls) => ({
    cls,
    entries: results.filter((r) => r.class === cls),
  })).filter((g) => g.entries.length > 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">통합 검색</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {q ? (
            <>
              &ldquo;{q}&rdquo; 결과{" "}
              <span className="text-fg-subtle">{results.length}건</span>
            </>
          ) : (
            "종목 검색"
          )}
        </h1>

        {/* 큰 search input — 결과 페이지에서 다른 검색어 시도 */}
        <form action={`/${locale}/search`} method="get" className="mt-4">
          <div className="relative max-w-xl">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="종목 · 심볼 · 한글명 · 6자리 코드"
              autoComplete="off"
              autoFocus={!q}
              className="w-full rounded-md border border-line bg-bg py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
          </div>
        </form>

        {!q && (
          <p className="mt-3 max-w-2xl text-xs text-fg-muted">
            예시 키워드: <span className="text-fg">비트</span> ·{" "}
            <span className="text-fg">AAPL</span> ·{" "}
            <span className="text-fg">005930</span> ·{" "}
            <span className="text-fg">ㅂㅌㅋ</span> (초성) ·{" "}
            <span className="text-fg">qlxmzhdls</span> (두벌식). 또는 헤더 검색창
            (<kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">/</kbd> · <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">⌘K</kbd>).
          </p>
        )}
      </header>

      {q && results.length === 0 && (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center">
          <p className="text-sm font-medium text-fg">검색 결과 없음</p>
          <p className="mt-2 text-xs text-fg-muted">
            정적 인덱스 80 종목 기준. 한글명·영문명·티커·6자리 코드·한글 초성·영문 두벌식 모두 매칭.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.cls} className="mt-6">
          <header className="mb-3 flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="text-sm font-semibold text-fg">
              {ASSET_LABEL[group.cls]}
              <span className="ml-2 text-xs text-fg-subtle tabular-nums">
                {group.entries.length}
              </span>
            </h2>
            <Link
              href={`/${group.cls}`}
              className="text-[11px] text-fg-subtle hover:text-fg"
            >
              전체 →
            </Link>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.entries.map((entry) => {
              const displayName =
                locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
              const href = `/${entry.class}/${entry.symbol}`;
              const quote = quoteMap.get(`${entry.class}:${entry.symbol}`);
              const spark = sparkResults.get(entry.symbol);
              return (
                <li key={`${entry.class}:${entry.symbol}`}>
                  <Link
                    href={href}
                    className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-fg">
                        {displayName}
                      </span>
                      <span className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">
                        {entry.ticker}
                      </span>
                    </div>
                    {quote ? (
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm tabular-nums text-fg">
                          {priceFmt(quote.currency).format(quote.price)}
                        </span>
                        <FinancialDelta
                          changePct={quote.changePct24h}
                          digits={2}
                        />
                      </div>
                    ) : (
                      <p className="truncate text-xs text-fg-subtle">
                        {entry.nameKo && entry.name !== entry.nameKo
                          ? entry.name
                          : ""}
                      </p>
                    )}
                    {spark && spark.length >= 2 && (
                      <Sparkline
                        values={spark}
                        width={120}
                        height={28}
                        ariaLabel={`${displayName} 7일 추세`}
                        className="w-full opacity-90"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {q && results.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SearchResultsPage",
              url: absoluteUrl(`/${locale}/search?q=${encodeURIComponent(q)}`),
              about: {
                "@type": "Thing",
                name: q,
              },
            }),
          }}
        />
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
      </footer>
    </main>
  );
}
