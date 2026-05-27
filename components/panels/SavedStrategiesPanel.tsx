"use client";

import {useMemo, useState} from "react";
import {Bookmark, Trash2, Pencil, Check, X, Search} from "lucide-react";
import {useLocale} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useSavedStrategies, type SavedStrategy} from "@/lib/strategies/saved";
import {getStrategy} from "@/lib/backtest/strategies/registry";
import {getAssetMeta} from "@/lib/symbols/registry";
import {serializeConfig, formatGroup} from "@/lib/backtest/conditions";

// 사용자 저장 전략 페이지 — 정렬 + 검색 + rename inline.
// 카드 클릭 → /backtest/new?... URL prefill.

type SortKey = "recent" | "name" | "asset" | "strategy";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "최근 저장",
  name: "이름",
  asset: "종목",
  strategy: "전략",
};

function buildBacktestHref(s: SavedStrategy): string {
  // custom 전략 → /backtest/custom?cfg=...
  if (s.kind === "custom" && s.customConfig) {
    const params = new URLSearchParams({
      asset: s.defaultClass,
      symbol: s.defaultSymbol,
      cfg: serializeConfig(s.customConfig),
    });
    return `/backtest/custom?${params.toString()}`;
  }
  const params = new URLSearchParams({
    asset: s.defaultClass,
    symbol: s.defaultSymbol,
    strategy: s.strategyId,
  });
  for (const [k, v] of Object.entries(s.params)) {
    params.set(k, String(v));
  }
  return `/backtest/new?${params.toString()}`;
}

export function SavedStrategiesPanel() {
  const {items, remove, rename} = useSavedStrategies();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) {
      list = list.filter((s) => {
        const asset = getAssetMeta(s.defaultClass, s.defaultSymbol);
        const strategyName = getStrategy(s.strategyId)?.nameKo ?? s.strategyId;
        const tokens = [
          s.name.toLowerCase(),
          s.strategyId.toLowerCase(),
          strategyName.toLowerCase(),
          s.defaultSymbol.toLowerCase(),
          s.defaultClass.toLowerCase(),
          asset?.name.toLowerCase() ?? "",
          asset?.nameKo?.toLowerCase() ?? "",
          asset?.ticker?.toLowerCase() ?? "",
        ];
        return tokens.some((t) => t.includes(q));
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "ko");
        case "asset":
          return a.defaultClass === b.defaultClass
            ? a.defaultSymbol.localeCompare(b.defaultSymbol)
            : a.defaultClass.localeCompare(b.defaultClass);
        case "strategy":
          return a.strategyId.localeCompare(b.strategyId);
        case "recent":
        default:
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
      }
    });
    return sorted;
  }, [items, query, sortKey]);

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <Bookmark
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">아직 저장된 전략이 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          백테스트 작업장에서 전략 + 파라미터를 조정하고 &quot;전략 저장&quot;
          버튼을 눌러보세요.
        </p>
        <Link
          href="/backtest/new"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          새 백테스트 시작 →
        </Link>
      </section>
    );
  }

  function startEdit(s: SavedStrategy) {
    setEditingId(s.id);
    setEditValue(s.name);
  }
  function saveEdit() {
    if (!editingId) return;
    const trimmed = editValue.trim();
    if (trimmed) rename(editingId, trimmed);
    setEditingId(null);
    setEditValue("");
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 필터 + 정렬 + 카운트 */}
      <div className="flex flex-wrap items-center gap-3">
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
            placeholder="이름 / 전략 / 종목 검색"
            className="w-full rounded-md border border-line bg-bg py-1.5 pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortKey(k)}
              aria-pressed={sortKey === k}
              className={
                sortKey === k
                  ? "rounded-md bg-fg px-2.5 py-1 text-[11px] font-medium text-bg"
                  : "rounded-md border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
              }
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-fg-subtle tabular-nums">
          {filtered.length}/{items.length}
        </span>
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center text-xs text-fg-muted">
          &ldquo;{query}&rdquo; 매칭 결과 없음
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const meta = getStrategy(s.strategyId);
            const asset = getAssetMeta(s.defaultClass, s.defaultSymbol);
            const symbolLabel = asset
              ? locale === "ko" && asset.nameKo
                ? asset.nameKo
                : asset.name
              : s.defaultSymbol.toUpperCase();
            const paramKeys = Object.keys(s.params);
            const isEditing = editingId === s.id;
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg-subtle"
              >
                {/* 헤더 — 이름 (rename inline) + 자산군 badge */}
                <div className="flex items-start justify-between gap-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium text-fg focus:border-fg focus:outline-none"
                    />
                  ) : (
                    <Link
                      href={buildBacktestHref(s)}
                      className="flex-1 truncate text-sm font-medium text-fg hover:text-accent"
                    >
                      {s.name}
                    </Link>
                  )}
                  <span className="shrink-0 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">
                    {s.defaultClass}
                  </span>
                </div>

                {/* 본문 — Link 안 */}
                <Link
                  href={buildBacktestHref(s)}
                  className="flex flex-col gap-1"
                >
                  <p className="text-xs text-fg-muted">
                    {s.kind === "custom" ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="rounded-full bg-fg/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
                          🧪 커스텀
                        </span>
                      </span>
                    ) : (
                      <>{meta?.nameKo ?? meta?.name ?? s.strategyId}</>
                    )}{" "}
                    · {symbolLabel}{" "}
                    <span className="text-fg-subtle">
                      ({asset?.ticker ?? s.defaultSymbol.toUpperCase()})
                    </span>
                  </p>
                  {s.kind === "custom" && s.customConfig ? (
                    <p className="text-[11px] text-fg-subtle">
                      <span className="text-[var(--color-up)]">매수:</span>{" "}
                      {formatGroup(s.customConfig.buy)}
                      <br />
                      <span className="text-[var(--color-down)]">매도:</span>{" "}
                      {formatGroup(s.customConfig.sell)}
                    </p>
                  ) : paramKeys.length > 0 ? (
                    <p className="text-[11px] text-fg-subtle">
                      {paramKeys.map((k) => `${k}=${s.params[k]}`).join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-fg-subtle">
                    저장: {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                    {s.updatedAt !== s.createdAt && (
                      <>
                        {" · "}
                        수정:{" "}
                        {new Date(s.updatedAt).toLocaleDateString("ko-KR")}
                      </>
                    )}
                  </p>
                </Link>

                {/* 액션 — rename / delete */}
                <div className="ml-auto flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-fg px-2 text-[11px] font-medium text-bg transition-opacity hover:opacity-90"
                        aria-label="이름 저장"
                      >
                        <Check size={11} aria-hidden="true" />
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex h-7 items-center rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-subtle transition-colors hover:text-fg"
                        aria-label="취소"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-subtle transition-colors hover:border-fg hover:text-fg"
                        aria-label={`${s.name} 이름 변경`}
                      >
                        <Pencil size={11} aria-hidden="true" />
                        이름 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`"${s.name}" 전략을 삭제할까요?`)) {
                            remove(s.id);
                          }
                        }}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-subtle transition-colors hover:border-[var(--color-down)] hover:text-[var(--color-down)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        aria-label={`${s.name} 삭제`}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
