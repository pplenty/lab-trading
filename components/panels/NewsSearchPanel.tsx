"use client";

import {useMemo, useState} from "react";
import {Search, LayoutGrid, List} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {NewsCard} from "./NewsCard";
import type {NewsArticleView} from "@/lib/data/news";
import type {AssetClass} from "@/lib/types";

// 통합 뉴스 검색/필터 — 3 자산군 article 을 한 client 에서 검색 + 자산군/매체 필터 + 정렬.
// view 토글: 자산군 grid (기본) / 통합 timeline (최신순).

export type NewsArticleWithAsset = NewsArticleView & {asset: AssetClass};

type Props = {
  articles: NewsArticleWithAsset[];
  locale: string;
  assetLabels: Record<AssetClass, string>;
};

type View = "grid" | "timeline";
type AssetFilter = AssetClass | "all";

const ASSET_HREF: Record<AssetClass, string> = {
  crypto: "/crypto/news",
  us: "/us/news",
  kr: "/kr/news",
};

export function NewsSearchPanel({articles, locale, assetLabels}: Props) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // 매체 목록 + 카운트
  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([source, count]) => ({source, count}))
      .sort((a, b) => b.count - a.count);
  }, [articles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (assetFilter !== "all" && a.asset !== assetFilter) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      if (q) {
        const inTitle = a.title.toLowerCase().includes(q);
        const inSummary = (a.summary ?? "").toLowerCase().includes(q);
        if (!inTitle && !inSummary) return false;
      }
      return true;
    });
  }, [articles, query, assetFilter, sourceFilter]);

  // timeline: 전체 최신순. grid: 자산군별 그룹.
  const timeline = useMemo(
    () => [...filtered].sort((a, b) => b.publishedAt - a.publishedAt),
    [filtered]
  );
  const byAsset = useMemo(() => {
    const map: Record<AssetClass, NewsArticleWithAsset[]> = {
      crypto: [],
      us: [],
      kr: [],
    };
    for (const a of filtered) map[a.asset].push(a);
    for (const k of Object.keys(map) as AssetClass[]) {
      map[k].sort((a, b) => b.publishedAt - a.publishedAt);
    }
    return map;
  }, [filtered]);

  // 검색/필터 활성 시 자동 timeline (자산군 grid 무의미)
  const effectiveView: View =
    query.trim() || assetFilter !== "all" || sourceFilter !== "all"
      ? "timeline"
      : view;

  const counts = useMemo(
    () => ({
      total: articles.length,
      crypto: articles.filter((a) => a.asset === "crypto").length,
      us: articles.filter((a) => a.asset === "us").length,
      kr: articles.filter((a) => a.asset === "kr").length,
    }),
    [articles]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 검색 + 필터 + view 토글 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="헤드라인 검색 (제목 · 요약)"
              className="w-full rounded-md border border-line bg-bg py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-md border border-line bg-bg p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={effectiveView === "grid"}
              aria-label="자산군 grid"
              className={
                "inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] " +
                (effectiveView === "grid"
                  ? "bg-fg text-bg"
                  : "text-fg-muted hover:text-fg")
              }
            >
              <LayoutGrid size={11} aria-hidden="true" />
              자산군
            </button>
            <button
              type="button"
              onClick={() => setView("timeline")}
              aria-pressed={effectiveView === "timeline"}
              aria-label="통합 timeline"
              className={
                "inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] " +
                (effectiveView === "timeline"
                  ? "bg-fg text-bg"
                  : "text-fg-muted hover:text-fg")
              }
            >
              <List size={11} aria-hidden="true" />
              최신순
            </button>
          </div>
        </div>

        {/* 자산군 + 매체 필터 chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label={`전체 ${counts.total}`}
            active={assetFilter === "all"}
            onClick={() => setAssetFilter("all")}
          />
          {(["crypto", "us", "kr"] as AssetClass[]).map((a) => (
            <FilterChip
              key={a}
              label={`${assetLabels[a]} ${counts[a]}`}
              active={assetFilter === a}
              onClick={() => setAssetFilter(assetFilter === a ? "all" : a)}
            />
          ))}
          <span className="mx-1 h-3 w-px bg-line" aria-hidden="true" />
          <FilterChip
            label="전체 매체"
            active={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
          />
          {sources.map(({source, count}) => (
            <FilterChip
              key={source}
              label={`${source} ${count}`}
              active={sourceFilter === source}
              onClick={() =>
                setSourceFilter(sourceFilter === source ? "all" : source)
              }
            />
          ))}
          <span className="ml-auto text-[11px] tabular-nums text-fg-subtle">
            {filtered.length} 건
          </span>
        </div>
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center text-xs text-fg-muted">
          매칭 결과 없음
        </div>
      ) : effectiveView === "timeline" ? (
        <ol className="flex flex-col gap-2">
          {timeline.map((a) => (
            <li key={a.url} className="flex items-start gap-2">
              <span className="mt-2 shrink-0 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">
                {assetLabels[a.asset]}
              </span>
              <div className="flex-1 min-w-0">
                <NewsCard article={a} locale={locale} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {(["crypto", "us", "kr"] as AssetClass[]).map((a) => (
            <section key={a}>
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
                  {assetLabels[a]}
                </h2>
                <Link
                  href={ASSET_HREF[a]}
                  className="text-[11px] text-fg-subtle hover:text-fg"
                >
                  전체 →
                </Link>
              </header>
              {byAsset[a].length === 0 ? (
                <div className="rounded-lg border border-line bg-surface/40 p-4 text-xs text-fg-muted">
                  수집된 뉴스 없음
                </div>
              ) : (
                <ol className="flex flex-col gap-2">
                  {byAsset[a].slice(0, 8).map((article) => (
                    <li key={article.url}>
                      <NewsCard article={article} locale={locale} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors " +
        (active
          ? "border-fg bg-fg text-bg"
          : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
      }
    >
      {label}
    </button>
  );
}
