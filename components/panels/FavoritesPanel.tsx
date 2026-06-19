"use client";

import {useEffect, useMemo, useState} from "react";
import {Star, Tag, Search, Trash2, Pencil, X, Check, ArrowDownUp} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {
  useFavorites,
  parseFavoriteId,
  type FavoriteId,
} from "@/lib/favorites";
import {useFavoriteLabels} from "@/lib/favorite-labels";
import {getAssetMeta} from "@/lib/symbols/registry";
import {FinancialDelta} from "@/components/FinancialDelta";
import {buildFavoriteDigest} from "@/lib/favorites/digest";
import type {AssetClass, Quote} from "@/lib/types";

// 즐겨찾기 통합 페이지 — 라벨별 group + 자산군 필터 + 검색.
// 사용자 자산 80 종목 즐겨찾기 늘면 분류 필요.

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

type QuotesMap = Record<string, Quote | null>;
type SortMode = "change" | "name";
const QUOTE_BATCH = 30; // /api/portfolio-quotes MAX_SYMBOLS

function fmtPrice(p: number, currency: string): string {
  if (currency === "KRW") return `₩${p.toLocaleString("ko-KR")}`;
  if (currency === "USD")
    return `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
  return p.toLocaleString();
}

type FilterLabel = string | "__all__" | "__none__";

type FavoriteEntry = {
  id: FavoriteId;
  class: AssetClass;
  symbol: string;
  displayName: string;
  ticker: string;
  labels: string[];
};

export function FavoritesPanel() {
  const {favorites, toggle} = useFavorites();
  const {
    allLabels,
    labelsFor,
    addLabel,
    removeLabel,
    renameLabel,
    deleteLabelEverywhere,
  } = useFavoriteLabels();

  const [filter, setFilter] = useState<FilterLabel>("__all__");
  const [assetFilter, setAssetFilter] = useState<AssetClass | "all">("all");
  const [query, setQuery] = useState("");
  const [quotes, setQuotes] = useState<QuotesMap>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("change");

  // hydrate — 즐겨찾기 + meta + labels
  const entries = useMemo<FavoriteEntry[]>(() => {
    return favorites
      .map((id) => {
        const {class: cls, symbol} = parseFavoriteId(id);
        const meta = getAssetMeta(cls, symbol);
        return {
          id,
          class: cls,
          symbol,
          displayName: meta?.nameKo ?? meta?.name ?? symbol.toUpperCase(),
          ticker: meta?.ticker ?? symbol.toUpperCase(),
          labels: labelsFor(id),
        };
      })
      .filter((e) => Boolean(getAssetMeta(e.class, e.symbol))); // dead 종목 제거
  }, [favorites, labelsFor]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (assetFilter !== "all" && e.class !== assetFilter) return false;
      if (filter === "__none__" && e.labels.length > 0) return false;
      if (filter !== "__all__" && filter !== "__none__" && !e.labels.includes(filter))
        return false;
      if (q) {
        const meta = getAssetMeta(e.class, e.symbol);
        if (
          !e.displayName.toLowerCase().includes(q) &&
          !e.symbol.toLowerCase().includes(q) &&
          !e.ticker.toLowerCase().includes(q) &&
          !(meta?.name?.toLowerCase().includes(q) ?? false) &&
          !e.labels.some((l) => l.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
  }, [entries, filter, assetFilter, query]);

  const counts = useMemo(
    () => ({
      total: entries.length,
      noLabel: entries.filter((e) => e.labels.length === 0).length,
      crypto: entries.filter((e) => e.class === "crypto").length,
      us: entries.filter((e) => e.class === "us").length,
      kr: entries.filter((e) => e.class === "kr").length,
    }),
    [entries]
  );

  // 시세 batch fetch — /api/portfolio-quotes (KV 60s 캐시). entry.id 가 "cls:symbol"
  // 토큰과 동일. 30 cap 초과 시 chunk. 전부 client 라 SSR 부담 0.
  const idsKey = useMemo(
    () => entries.map((e) => e.id).sort().join(","),
    [entries]
  );
  useEffect(() => {
    if (idsKey === "") {
      setQuotes({});
      return;
    }
    const ids = idsKey.split(",");
    let cancelled = false;
    (async () => {
      setQuotesLoading(true);
      try {
        const merged: QuotesMap = {};
        for (let i = 0; i < ids.length; i += QUOTE_BATCH) {
          const chunk = ids.slice(i, i + QUOTE_BATCH);
          const res = await fetch(
            `/api/portfolio-quotes?symbols=${encodeURIComponent(chunk.join(","))}`,
            {cache: "no-store"}
          );
          if (!res.ok) continue;
          const data = (await res.json()) as {quotes: QuotesMap};
          Object.assign(merged, data.quotes);
        }
        if (!cancelled) setQuotes(merged);
      } catch {
        if (!cancelled) setQuotes({});
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  // 변동률 정렬 (quote 없는 종목은 뒤로). 이름순은 가나다/알파벳.
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (sortMode === "name") {
      arr.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
    } else {
      arr.sort((a, b) => {
        const ca = quotes[a.id]?.changePct24h ?? -Infinity;
        const cb = quotes[b.id]?.changePct24h ?? -Infinity;
        return cb - ca;
      });
    }
    return arr;
  }, [filtered, sortMode, quotes]);

  // 필터된 집합의 다이제스트 — 라벨/자산 필터 시 해당 그룹 요약으로 동작.
  const digest = useMemo(
    () =>
      buildFavoriteDigest(
        filtered.map((e) => ({
          id: e.id,
          symbol: e.symbol,
          changePct: quotes[e.id]?.changePct24h ?? null,
        }))
      ),
    [filtered, quotes]
  );

  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <Star
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">즐겨찾기가 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          종목 상세 페이지의{" "}
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-line bg-bg align-middle text-fg-subtle">
            ⭐
          </span>{" "}
          버튼으로 추가하세요.
        </p>
        <Link
          href="/crypto/btc"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          비트코인부터 시작 →
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 라벨 chips + 자산 필터 + 검색 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label={`전체 ${counts.total}`}
            active={filter === "__all__"}
            onClick={() => setFilter("__all__")}
          />
          <FilterChip
            label={`미분류 ${counts.noLabel}`}
            active={filter === "__none__"}
            onClick={() => setFilter("__none__")}
            muted
          />
          {allLabels.map(({label, count}) => (
            <LabelChip
              key={label}
              label={label}
              count={count}
              active={filter === label}
              onClick={() => setFilter(filter === label ? "__all__" : label)}
              onRename={(newName) => {
                renameLabel(label, newName);
                if (filter === label) setFilter(newName);
              }}
              onDelete={() => {
                if (window.confirm(`"${label}" 라벨을 모든 종목에서 제거할까요?`)) {
                  deleteLabelEverywhere(label);
                  if (filter === label) setFilter("__all__");
                }
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value as AssetClass | "all")}
            className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
          >
            <option value="all">전체 자산</option>
            <option value="crypto">코인 ({counts.crypto})</option>
            <option value="us">해외주식 ({counts.us})</option>
            <option value="kr">국내주식 ({counts.kr})</option>
          </select>
          <div className="relative flex-1 max-w-xs">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목 · 라벨 검색"
              className="w-full rounded-md border border-line bg-bg py-1 pl-7 pr-2 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === "change" ? "name" : "change"))}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-2 py-1 text-[11px] text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
              aria-label="정렬 전환"
            >
              <ArrowDownUp size={11} aria-hidden="true" />
              {sortMode === "change" ? "변동률순" : "이름순"}
            </button>
            <span className="text-[11px] tabular-nums text-fg-subtle">
              {filtered.length} 종목
            </span>
          </div>
        </div>
      </div>

      {/* 오늘 요약 — 필터된 집합 기준 (라벨/자산 필터 시 그룹 다이제스트) */}
      {filtered.length > 0 && (
        <section
          aria-label="관심종목 오늘 요약"
          className="rounded-lg border border-line bg-surface/40 px-4 py-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-fg-subtle">오늘</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-[var(--color-up)]">▲ {digest.upCount}</span>
                <span className="text-[var(--color-down)]">▼ {digest.downCount}</span>
                {digest.flatCount > 0 && (
                  <span className="text-fg-subtle">— {digest.flatCount}</span>
                )}
              </span>
              {digest.avgChangePct !== null && (
                <span className="flex items-center gap-1 text-fg-subtle">
                  평균 <FinancialDelta changePct={digest.avgChangePct} />
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {digest.topGainer && (
                <span className="flex items-center gap-1 text-fg-subtle">
                  최고{" "}
                  <span className="font-medium text-fg">
                    {entries.find((e) => e.id === digest.topGainer!.id)?.displayName ??
                      digest.topGainer.symbol.toUpperCase()}
                  </span>
                  <FinancialDelta changePct={digest.topGainer.changePct} />
                </span>
              )}
              {digest.topLoser && digest.topLoser.id !== digest.topGainer?.id && (
                <span className="flex items-center gap-1 text-fg-subtle">
                  최저{" "}
                  <span className="font-medium text-fg">
                    {entries.find((e) => e.id === digest.topLoser!.id)?.displayName ??
                      digest.topLoser.symbol.toUpperCase()}
                  </span>
                  <FinancialDelta changePct={digest.topLoser.changePct} />
                </span>
              )}
              {quotesLoading ? (
                <span className="text-fg-subtle">시세 불러오는 중…</span>
              ) : (
                digest.stale > 0 && (
                  <span className="text-fg-subtle">
                    · {digest.stale} 데이터 대기
                  </span>
                )
              )}
            </span>
          </div>
        </section>
      )}

      {/* list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center text-xs text-fg-muted">
          매칭 결과 없음
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedFiltered.map((e) => (
            <FavoriteRow
              key={e.id}
              entry={e}
              quote={quotes[e.id]}
              allLabels={allLabels.map((l) => l.label)}
              onAddLabel={(label) => addLabel(e.id, label)}
              onRemoveLabel={(label) => removeLabel(e.id, label)}
              onUnfavorite={() => toggle(e.class, e.symbol)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  muted,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors " +
        (active
          ? "border-fg bg-fg text-bg"
          : muted
          ? "border-line bg-bg text-fg-subtle hover:text-fg"
          : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

function LabelChip({
  label,
  count,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-fg bg-bg px-2 py-0.5 text-[11px]">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(value);
              setEditing(false);
            }
            if (e.key === "Escape") {
              setValue(label);
              setEditing(false);
            }
          }}
          maxLength={16}
          className="w-20 bg-transparent text-xs text-fg outline-none"
        />
        <button
          type="button"
          onClick={() => {
            onRename(value);
            setEditing(false);
          }}
          className="text-fg-subtle hover:text-fg"
          aria-label="저장"
        >
          <Check size={11} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(label);
            setEditing(false);
          }}
          className="text-fg-subtle hover:text-fg"
          aria-label="취소"
        >
          <X size={11} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <span
      className={
        "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors " +
        (active
          ? "border-fg bg-fg/10 text-fg"
          : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
      }
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1">
        <Tag size={10} aria-hidden="true" />
        {label}
        <span className="text-[10px] tabular-nums opacity-60">·{count}</span>
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${label} 이름 변경`}
        className="ml-0.5 hidden h-4 w-4 items-center justify-center rounded text-fg-subtle hover:bg-surface hover:text-fg group-hover:inline-flex"
      >
        <Pencil size={9} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${label} 삭제`}
        className="hidden h-4 w-4 items-center justify-center rounded text-fg-subtle hover:bg-surface hover:text-[var(--color-down)] group-hover:inline-flex"
      >
        <Trash2 size={9} aria-hidden="true" />
      </button>
    </span>
  );
}

function FavoriteRow({
  entry,
  quote,
  allLabels,
  onAddLabel,
  onRemoveLabel,
  onUnfavorite,
}: {
  entry: FavoriteEntry;
  quote: Quote | null | undefined;
  allLabels: string[];
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  onUnfavorite: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");

  function submitLabel() {
    if (input.trim()) {
      onAddLabel(input);
      setInput("");
    }
    setAdding(false);
  }

  // 빠른 추가 suggestion — 아직 안 붙은 기존 라벨
  const suggestions = allLabels.filter((l) => !entry.labels.includes(l)).slice(0, 5);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          href={`/${entry.class}/${entry.symbol}`}
          className="flex min-w-0 items-baseline gap-2 hover:text-accent"
        >
          <span className="truncate text-sm font-medium text-fg">
            {entry.displayName}
          </span>
          <span className="text-[11px] text-fg-subtle">{entry.ticker}</span>
        </Link>
        <span className="hidden whitespace-nowrap text-[10px] uppercase tracking-wider text-fg-subtle sm:inline">
          {ASSET_LABEL[entry.class]}
        </span>
        {quote === undefined ? (
          <span
            className="shrink-0 text-[11px] text-fg-subtle"
            aria-hidden="true"
          >
            ···
          </span>
        ) : quote === null ? (
          <span className="shrink-0 whitespace-nowrap text-[11px] text-fg-subtle">
            데이터 대기
          </span>
        ) : (
          <span className="flex shrink-0 items-baseline gap-2 whitespace-nowrap tabular-nums">
            <span className="text-xs text-fg-muted">
              {fmtPrice(quote.price, quote.currency)}
            </span>
            <FinancialDelta changePct={quote.changePct24h} className="text-xs" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {entry.labels.map((l) => (
          <span
            key={l}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-fg-muted"
          >
            <Tag size={9} aria-hidden="true" className="opacity-60" />
            {l}
            <button
              type="button"
              onClick={() => onRemoveLabel(l)}
              aria-label={`${l} 라벨 제거`}
              className="text-fg-subtle hover:text-[var(--color-down)]"
            >
              <X size={9} aria-hidden="true" />
            </button>
          </span>
        ))}

        {adding ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-fg bg-bg px-2 py-0.5 text-[10px]">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitLabel();
                if (e.key === "Escape") {
                  setInput("");
                  setAdding(false);
                }
              }}
              onBlur={() => {
                if (!input.trim()) setAdding(false);
              }}
              list={`labels-${entry.id}`}
              maxLength={16}
              placeholder="라벨"
              className="w-20 bg-transparent text-xs text-fg outline-none"
            />
            {suggestions.length > 0 && (
              <datalist id={`labels-${entry.id}`}>
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            <button
              type="button"
              onClick={submitLabel}
              aria-label="라벨 추가"
              className="text-fg-subtle hover:text-fg"
            >
              <Check size={10} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="라벨 추가"
            className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-line px-2 text-[10px] text-fg-subtle transition-colors hover:border-fg hover:text-fg"
          >
            <Tag size={9} aria-hidden="true" />+
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (window.confirm(`${entry.displayName} 을 즐겨찾기에서 제거할까요?`)) {
              onUnfavorite();
            }
          }}
          aria-label="즐겨찾기 해제"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
        >
          <Star size={11} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
