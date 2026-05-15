import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {searchAssets} from "@/lib/search";

// 통합 검색 결과 페이지 — `/<locale>/search?q=...`.
// 헤더의 SearchBox listbox 는 빠른 진입용. 본 페이지는:
//   - URL share / 북마크 / 외부 진입 (검색엔진 sitelinks searchbox 의 target)
//   - 결과 다수 노출 + 더 풍부한 메타 (자산군 / ticker)
// 정적 인덱스 36 종목 (ADR-0022 1차) — D1 LIKE fallback 은 Phase 1.5.

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
    robots: {index: false}, // 검색 결과 페이지는 noindex (SEO 관행)
  };
}

const ASSET_LABEL: Record<"crypto" | "us" | "kr", string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">통합 검색</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {q ? <>&ldquo;{q}&rdquo; 결과 <span className="text-fg-subtle">{results.length}건</span></> : "종목 검색"}
        </h1>
        {!q && (
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            헤더의 검색창 (또는 <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">/</kbd> · <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">⌘K</kbd>) 으로 종목명·티커·한글명을 입력하세요. 직접 URL 로 진입하려면 <code className="rounded bg-surface px-1 font-mono text-[11px]">?q=비트</code> 같은 파라미터를 붙이면 됩니다.
          </p>
        )}
      </header>

      {q && results.length === 0 && (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center">
          <p className="text-sm font-medium text-fg">검색 결과 없음</p>
          <p className="mt-2 text-xs text-fg-muted">
            정적 인덱스 36 종목 기준 (Phase 1.5 에 D1 + 전 종목 확장). 한글명·영문명·티커·6자리 코드 모두 검색 가능.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((entry) => {
            const displayName =
              locale === "ko" && entry.nameKo ? entry.nameKo : entry.name;
            const href = `/${entry.class}/${entry.symbol}`;
            return (
              <li key={`${entry.class}:${entry.symbol}`}>
                <Link
                  href={href}
                  className="flex flex-col gap-1 rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">
                      {displayName}
                    </span>
                    <span className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">
                      {ASSET_LABEL[entry.class]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-fg-muted">
                    {entry.ticker}
                    {entry.nameKo && entry.name !== entry.nameKo && (
                      <span className="ml-2 text-fg-subtle">{entry.name}</span>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

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
