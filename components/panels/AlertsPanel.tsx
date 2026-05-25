"use client";

import {useEffect, useMemo, useState} from "react";
import {Bell, BellOff, Trash2, Check, Search, RefreshCw} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {useAlerts, type PriceAlert} from "@/lib/alerts";
import {getAssetMeta} from "@/lib/symbols/registry";
import type {AssetClass, Quote} from "@/lib/types";

// 사용자 알림 일괄 관리 — /ko/alerts.
// 활성 (acknowledged X) / 도달 (triggered) / 일반 list 탭 + 검색 + 자산군 필터.

type Tab = "active" | "triggered" | "all";
type AssetFilter = AssetClass | "all";
type SortMode = "default" | "proximity";

type QuotesMap = Record<string, Quote | null>;

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

function fmtPrice(price: number, asset: AssetClass): string {
  const currency = asset === "us" ? "USD" : "KRW";
  return currency === "KRW"
    ? `₩${price.toLocaleString("ko-KR")}`
    : `$${price.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
}

export function AlertsPanel() {
  const {items, remove, acknowledge} = useAlerts();
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [quotes, setQuotes] = useState<QuotesMap>({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  // batch fetch — active alert 의 종목들. acknowledged 알림은 가격 무관.
  const activeSymbols = useMemo(() => {
    const keys = new Set<string>();
    for (const a of items) {
      if (!a.acknowledged) keys.add(`${a.class}:${a.symbol}`);
    }
    return Array.from(keys);
  }, [items]);

  const symbolsKey = activeSymbols.join(",");

  useEffect(() => {
    if (symbolsKey === "") {
      setQuotes({});
      return;
    }
    let cancelled = false;
    setQuotesLoading(true);
    fetch(`/api/portfolio-quotes?symbols=${encodeURIComponent(symbolsKey)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : {quotes: {}}))
      .then((data: {quotes: QuotesMap}) => {
        if (!cancelled) setQuotes(data.quotes ?? {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  function refreshQuotes() {
    if (symbolsKey === "") return;
    setQuotesLoading(true);
    fetch(
      `/api/portfolio-quotes?symbols=${encodeURIComponent(symbolsKey)}&_t=${Date.now()}`,
      {cache: "no-store"}
    )
      .then((res) => (res.ok ? res.json() : {quotes: {}}))
      .then((data: {quotes: QuotesMap}) => setQuotes(data.quotes ?? {}))
      .finally(() => setQuotesLoading(false));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (tab === "active") list = list.filter((a) => !a.acknowledged);
    else if (tab === "triggered")
      list = list.filter((a) => a.triggeredAt !== null);
    if (assetFilter !== "all") list = list.filter((a) => a.class === assetFilter);
    if (q) {
      list = list.filter((a) => {
        const meta = getAssetMeta(a.class, a.symbol);
        return (
          a.label.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          (meta?.name?.toLowerCase().includes(q) ?? false) ||
          (meta?.nameKo?.toLowerCase().includes(q) ?? false) ||
          (meta?.ticker?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return [...list].sort((a, b) => {
      // 도달 우선
      if (a.triggeredAt && !b.triggeredAt) return -1;
      if (!a.triggeredAt && b.triggeredAt) return 1;
      if (sortMode === "proximity") {
        // 임박순 — gap % (abs) 작은 순
        const ga = proximityGap(a, quotes);
        const gb = proximityGap(b, quotes);
        if (ga === null && gb === null) {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
        if (ga === null) return 1;
        if (gb === null) return -1;
        return ga - gb;
      }
      // default — 최신 생성
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [items, tab, query, assetFilter, sortMode, quotes]);

  // 자산군별 카운트 (active 기준)
  const counts = useMemo(() => {
    const active = items.filter((a) => !a.acknowledged);
    return {
      total: items.length,
      active: active.length,
      triggered: items.filter((a) => a.triggeredAt !== null).length,
      crypto: active.filter((a) => a.class === "crypto").length,
      us: active.filter((a) => a.class === "us").length,
      kr: active.filter((a) => a.class === "kr").length,
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <Bell
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">설정된 알림이 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          종목 상세 페이지 헤더의{" "}
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-line bg-bg align-middle text-fg-subtle">
            🔔
          </span>{" "}
          버튼으로 가격 알림을 추가하세요.
        </p>
        <Link
          href="/crypto/btc"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          비트코인으로 시작 →
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 + 자산군 필터 + 검색 + 카운트 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          {(["active", "triggered", "all"] as Tab[]).map((t) => {
            const label =
              t === "active"
                ? `활성 ${counts.active}`
                : t === "triggered"
                ? `도달 ${counts.triggered}`
                : `전체 ${counts.total}`;
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={active}
                className={
                  active
                    ? "rounded-md bg-fg px-3 py-1 text-xs font-medium text-bg"
                    : "rounded-md border border-line bg-bg px-3 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
            title="정렬"
          >
            <option value="default">최신순</option>
            <option value="proximity">임박순</option>
          </select>
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value as AssetFilter)}
            className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
          >
            <option value="all">전체 자산</option>
            <option value="crypto">코인 ({counts.crypto})</option>
            <option value="us">해외주식 ({counts.us})</option>
            <option value="kr">국내주식 ({counts.kr})</option>
          </select>
          <div className="relative">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목 검색"
              className="w-44 rounded-md border border-line bg-bg py-1 pl-7 pr-2 text-xs text-fg placeholder:text-fg-subtle focus:border-fg focus:outline-none"
            />
          </div>
          {activeSymbols.length > 0 && (
            <button
              type="button"
              onClick={refreshQuotes}
              disabled={quotesLoading}
              aria-label="현재가 새로고침"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-bg text-fg-subtle transition-colors hover:border-fg hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                aria-hidden="true"
                className={quotesLoading ? "animate-spin" : ""}
              />
            </button>
          )}
        </div>
      </div>

      {/* 결과 */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-center text-xs text-fg-muted">
          매칭 결과 없음
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              currentPrice={quotes[`${a.class}:${a.symbol}`]?.price}
              onRemove={() => remove(a.id)}
              onAcknowledge={() => acknowledge(a.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** 현재가 vs 알림가 — gap % (signed). null 이면 quote 없음. */
function proximityGap(a: PriceAlert, quotes: QuotesMap): number | null {
  const q = quotes[`${a.class}:${a.symbol}`];
  if (!q || q.price <= 0) return null;
  // gte: 도달까지 +X% 필요. 현재가 < 알림가 → 양수.
  // lte: 도달까지 -X% 필요. 현재가 > 알림가 → 양수.
  const diff = a.op === "gte" ? a.price - q.price : q.price - a.price;
  return (diff / q.price) * 100;
}

function AlertRow({
  alert,
  currentPrice,
  onRemove,
  onAcknowledge,
}: {
  alert: PriceAlert;
  currentPrice: number | undefined;
  onRemove: () => void;
  onAcknowledge: () => void;
}) {
  const triggered = alert.triggeredAt !== null;
  const active = !alert.acknowledged;
  const meta = getAssetMeta(alert.class, alert.symbol);
  const displayName = meta?.nameKo ?? meta?.name ?? alert.label;
  const ticker = meta?.ticker ?? alert.symbol.toUpperCase();

  // 임박도 — active 알림에만 의미. gap=0 이면 도달, +면 멀어짐, -면 이미 넘어감.
  let gapPct: number | null = null;
  if (active && currentPrice !== undefined && currentPrice > 0) {
    const diff =
      alert.op === "gte" ? alert.price - currentPrice : currentPrice - alert.price;
    gapPct = (diff / currentPrice) * 100;
  }
  // imminent — 5% 이내
  const imminent = gapPct !== null && Math.abs(gapPct) < 5 && gapPct > 0;
  // 이미 도달 조건 충족 (cron 으로 trigger 아직 안 됨)
  const reached = gapPct !== null && gapPct <= 0;

  const borderClass = triggered && active
    ? "border-[var(--color-up)]/40 bg-[var(--color-up)]/5"
    : reached
    ? "border-[var(--color-up)]/40 bg-[var(--color-up)]/5"
    : imminent
    ? "border-amber-500/40 bg-amber-500/5"
    : !active
    ? "border-line bg-bg opacity-60"
    : "border-line bg-bg";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${borderClass}`}
    >
      {/* 종목 + 조건 */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className={
            triggered && active
              ? "inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--color-up)]"
              : active
              ? "inline-block h-2 w-2 shrink-0 rounded-full bg-fg-muted"
              : "inline-block h-2 w-2 shrink-0 rounded-full bg-fg-subtle"
          }
        />
        <Link
          href={`/${alert.class}/${alert.symbol}`}
          className="truncate text-sm font-medium text-fg hover:text-accent"
        >
          {displayName}
        </Link>
        <span className="text-[11px] text-fg-subtle">{ticker}</span>
        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
          {ASSET_LABEL[alert.class]}
        </span>
      </div>

      {/* 조건 + 상태 */}
      <div className="flex items-center gap-3 text-xs">
        <span className="tabular-nums">
          <span className="text-fg-subtle">
            {alert.op === "gte" ? "≥" : "≤"}
          </span>{" "}
          <span className="font-medium text-fg">
            {fmtPrice(alert.price, alert.class)}
          </span>
        </span>
        {active && currentPrice !== undefined && (
          <span className="tabular-nums text-fg-subtle">
            현재{" "}
            <span className="text-fg-muted">
              {fmtPrice(currentPrice, alert.class)}
            </span>
            {gapPct !== null && (
              <span
                className={
                  "ml-1 " +
                  (reached
                    ? "text-[var(--color-up)] font-semibold"
                    : imminent
                    ? "text-amber-500 font-semibold"
                    : "text-fg-subtle")
                }
              >
                ({gapPct > 0 ? "+" : ""}
                {gapPct.toFixed(2)}%)
              </span>
            )}
          </span>
        )}
        {triggered ? (
          active ? (
            <span className="rounded-full bg-[var(--color-up)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-up)]">
              도달 ·{" "}
              {new Date(alert.triggeredAt!).toLocaleDateString("ko-KR")}
            </span>
          ) : (
            <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-fg-subtle">
              확인됨
            </span>
          )
        ) : (
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-fg-subtle">
            대기
          </span>
        )}
      </div>

      {/* 액션 */}
      <div className="flex items-center gap-1">
        {triggered && active && (
          <button
            type="button"
            onClick={onAcknowledge}
            aria-label="확인"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
          >
            <Check size={11} aria-hidden="true" />
            확인
          </button>
        )}
        {active && !triggered && (
          <button
            type="button"
            onClick={onAcknowledge}
            aria-label="비활성화"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-subtle transition-colors hover:border-fg hover:text-fg"
            title="알림 비활성화 (보관)"
          >
            <BellOff size={11} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`${displayName} ${alert.op === "gte" ? "≥" : "≤"} ${fmtPrice(alert.price, alert.class)} 알림을 삭제할까요?`)) {
              onRemove();
            }
          }}
          aria-label="삭제"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
        >
          <Trash2 size={11} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
