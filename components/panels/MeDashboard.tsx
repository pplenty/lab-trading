"use client";

import {useMemo} from "react";
import {
  Star,
  Clock,
  Bookmark,
  Bell,
  NotebookPen,
  Briefcase,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {useFavorites, parseFavoriteId} from "@/lib/favorites";
import {useFavoriteLabels} from "@/lib/favorite-labels";
import {useRecents} from "@/lib/recents";
import {useAlerts} from "@/lib/alerts";
import {useNotes} from "@/lib/notes";
import {useTrades} from "@/lib/paper";
import {useSavedStrategies} from "@/lib/strategies/saved";
import {getAssetMeta} from "@/lib/symbols/registry";
import {getStrategy} from "@/lib/backtest/strategies/registry";
import type {AssetClass} from "@/lib/types";

// 사용자 자산 통합 dashboard — 7 카테고리 한 화면 summary.
// 각 카드: count + 최근 항목 + "관리 →" 링크.

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외",
  kr: "국내",
};

function fmtRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.round(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.round(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

function fmtPrice(p: number, currency: string): string {
  if (currency === "KRW") return `₩${p.toLocaleString("ko-KR")}`;
  if (currency === "USD")
    return `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
  return p.toLocaleString();
}

export function MeDashboard() {
  const {favorites} = useFavorites();
  const {labels, allLabels} = useFavoriteLabels();
  const {recents} = useRecents();
  const {items: alerts} = useAlerts();
  const {items: notes} = useNotes();
  const {items: trades, positions} = useTrades();
  const {items: strategies} = useSavedStrategies();

  const empty =
    favorites.length === 0 &&
    recents.length === 0 &&
    alerts.length === 0 &&
    notes.length === 0 &&
    trades.length === 0 &&
    strategies.length === 0;

  // 즐겨찾기 카드 데이터
  const favEntries = useMemo(
    () =>
      favorites
        .map((id) => {
          const {class: cls, symbol} = parseFavoriteId(id);
          const meta = getAssetMeta(cls, symbol);
          return meta
            ? {
                id,
                class: cls,
                symbol,
                displayName: meta.nameKo ?? meta.name,
                ticker: meta.ticker,
                labels: labels[id] ?? [],
              }
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null),
    [favorites, labels]
  );

  // 최근 본
  const recentEntries = useMemo(
    () =>
      recents
        .map((r) => {
          const meta = getAssetMeta(r.class, r.symbol);
          return meta
            ? {
                class: r.class,
                symbol: r.symbol,
                displayName: meta.nameKo ?? meta.name,
                ticker: meta.ticker,
              }
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null),
    [recents]
  );

  // 알림 stats
  const alertStats = useMemo(() => {
    const active = alerts.filter((a) => !a.acknowledged);
    const triggered = alerts.filter((a) => a.triggeredAt !== null && !a.acknowledged);
    return {
      total: alerts.length,
      active: active.length,
      triggered: triggered.length,
      recent: alerts.slice(0, 3),
    };
  }, [alerts]);

  // 포트폴리오 stats
  const portfolioStats = useMemo(() => {
    const holding = positions.filter((p) => p.units > 0);
    const closed = positions.filter((p) => p.units === 0);
    const realizedByCurrency: Record<string, number> = {};
    for (const p of positions) {
      realizedByCurrency[p.currency] =
        (realizedByCurrency[p.currency] ?? 0) + p.realizedPnl;
    }
    return {
      holding: holding.length,
      closed: closed.length,
      tradeCount: trades.length,
      realizedByCurrency,
      recentHolding: holding.slice(0, 3),
    };
  }, [positions, trades]);

  if (empty) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <p className="text-sm font-medium text-fg">아직 기록된 자산이 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          종목 상세 페이지에서 즐겨찾기 / 메모 / 알림 / 가상매매를 시작하면 여기에
          한눈에 모입니다.
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* 즐겨찾기 */}
      <Card
        icon={<Star size={14} aria-hidden="true" />}
        title="즐겨찾기"
        count={favEntries.length}
        href="/favorites"
        ctaLabel="라벨 관리"
      >
        {favEntries.length === 0 ? (
          <Empty hint="⭐ 버튼으로 추가" />
        ) : (
          <>
            <ul className="flex flex-col gap-1.5 text-xs">
              {favEntries.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/${e.class}/${e.symbol}`}
                    className="flex items-center justify-between gap-2 rounded hover:bg-surface/50 hover:px-1.5"
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate font-medium text-fg">
                        {e.displayName}
                      </span>
                      <span className="text-[10px] text-fg-subtle">{e.ticker}</span>
                    </span>
                    {e.labels.length > 0 && (
                      <span className="shrink-0 truncate text-[10px] text-fg-subtle">
                        🏷 {e.labels.join(", ")}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {allLabels.length > 0 && (
              <p className="mt-2 text-[10px] text-fg-subtle">
                라벨 {allLabels.length}종: {allLabels.slice(0, 4).map((l) => l.label).join(", ")}
                {allLabels.length > 4 && " …"}
              </p>
            )}
          </>
        )}
      </Card>

      {/* 최근 본 */}
      <Card
        icon={<Clock size={14} aria-hidden="true" />}
        title="최근 본"
        count={recentEntries.length}
        href={recentEntries.length > 0 ? `/${recentEntries[0].class}/${recentEntries[0].symbol}` : "/crypto"}
        ctaLabel={recentEntries.length > 0 ? "마지막 종목" : "탐색"}
      >
        {recentEntries.length === 0 ? (
          <Empty hint="종목 상세를 보면 자동 기록" />
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {recentEntries.slice(0, 6).map((e) => (
              <li key={`${e.class}:${e.symbol}`}>
                <Link
                  href={`/${e.class}/${e.symbol}`}
                  className="flex items-center justify-between gap-2 rounded hover:bg-surface/50 hover:px-1.5"
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate font-medium text-fg">
                      {e.displayName}
                    </span>
                    <span className="text-[10px] text-fg-subtle">{e.ticker}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-subtle">
                    {ASSET_LABEL[e.class]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 가격 알림 */}
      <Card
        icon={<Bell size={14} aria-hidden="true" />}
        title="가격 알림"
        count={alertStats.active}
        countSuffix="활성"
        href="/alerts"
        ctaLabel="관리"
        accent={alertStats.triggered > 0 ? "up" : undefined}
      >
        {alerts.length === 0 ? (
          <Empty hint="종목 상세 🔔 버튼" />
        ) : (
          <>
            {alertStats.triggered > 0 && (
              <p className="mb-2 rounded-md border border-[var(--color-up)]/40 bg-[var(--color-up)]/5 px-2 py-1.5 text-[11px] text-[var(--color-up)]">
                🔔 도달 {alertStats.triggered}건 — 확인 필요
              </p>
            )}
            <ul className="flex flex-col gap-1 text-xs">
              {alertStats.recent.map((a) => {
                const meta = getAssetMeta(a.class, a.symbol);
                const name = meta?.nameKo ?? meta?.name ?? a.symbol;
                const cur = a.class === "us" ? "USD" : "KRW";
                return (
                  <li key={a.id}>
                    <Link
                      href={`/${a.class}/${a.symbol}`}
                      className="flex items-center justify-between gap-2 rounded hover:bg-surface/50 hover:px-1.5"
                    >
                      <span className="truncate font-medium text-fg">{name}</span>
                      <span className="shrink-0 tabular-nums text-fg-muted">
                        {a.op === "gte" ? "≥" : "≤"} {fmtPrice(a.price, cur)}
                        {a.triggeredAt && (
                          <span className="ml-1 text-[var(--color-up)]">●</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      {/* 메모 */}
      <Card
        icon={<NotebookPen size={14} aria-hidden="true" />}
        title="내 메모"
        count={notes.length}
        href="/notes"
        ctaLabel="관리"
      >
        {notes.length === 0 ? (
          <Empty hint="종목 상세 하단 메모 입력" />
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {notes.slice(0, 3).map((n) => {
              const meta = getAssetMeta(n.class, n.symbol);
              const name = meta?.nameKo ?? meta?.name ?? n.symbol;
              return (
                <li
                  key={n.id}
                  className="rounded border border-line bg-bg p-2"
                >
                  <Link
                    href={`/${n.class}/${n.symbol}`}
                    className="text-[11px] font-medium text-fg hover:text-accent"
                  >
                    {name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-fg-muted">
                    {n.text}
                  </p>
                  <p className="mt-0.5 text-[10px] text-fg-subtle">
                    {fmtRelative(n.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 가상 포트폴리오 */}
      <Card
        icon={<Briefcase size={14} aria-hidden="true" />}
        title="가상 포트폴리오"
        count={portfolioStats.holding}
        countSuffix="보유"
        href="/portfolio"
        ctaLabel="관리"
      >
        {trades.length === 0 ? (
          <Empty hint="종목 상세 💼 가상매매 버튼" />
        ) : (
          <>
            {/* 통화별 확정 PnL */}
            <div className="mb-2 flex flex-wrap gap-3 text-[11px]">
              {Object.entries(portfolioStats.realizedByCurrency).map(([curr, pnl]) =>
                pnl !== 0 ? (
                  <span key={curr} className="inline-flex items-baseline gap-1">
                    <span className="text-fg-subtle">{curr} 확정</span>
                    <span
                      className={
                        "tabular-nums font-medium " +
                        (pnl > 0
                          ? "text-[var(--color-up)]"
                          : "text-[var(--color-down)]")
                      }
                    >
                      {pnl > 0 ? "+" : ""}
                      {fmtPrice(pnl, curr)}
                    </span>
                  </span>
                ) : null
              )}
            </div>
            <ul className="flex flex-col gap-1 text-xs">
              {portfolioStats.recentHolding.map((p) => (
                <li key={`${p.class}:${p.symbol}`}>
                  <Link
                    href={`/${p.class}/${p.symbol}`}
                    className="flex items-center justify-between gap-2 rounded hover:bg-surface/50 hover:px-1.5"
                  >
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      <span className="truncate font-medium text-fg">{p.label}</span>
                      <span className="text-[10px] text-fg-subtle">
                        {p.units} units
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] text-fg-muted">
                      평단 {fmtPrice(p.avgPrice, p.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-fg-subtle">
              총 거래 {portfolioStats.tradeCount}건 · 종료 {portfolioStats.closed}건
            </p>
          </>
        )}
      </Card>

      {/* 저장된 전략 */}
      <Card
        icon={<Bookmark size={14} aria-hidden="true" />}
        title="저장된 전략"
        count={strategies.length}
        href="/backtest/saved"
        ctaLabel="목록"
      >
        {strategies.length === 0 ? (
          <Empty hint="백테스트 결과 카드 → '전략 저장'" />
        ) : (
          <ul className="flex flex-col gap-1.5 text-xs">
            {strategies.slice(0, 4).map((s) => {
              const strat = getStrategy(s.strategyId);
              return (
                <li key={s.id}>
                  <Link
                    href={`/backtest/new?asset=${s.defaultClass}&symbol=${s.defaultSymbol}&strategy=${s.strategyId}`}
                    className="flex items-center justify-between gap-2 rounded hover:bg-surface/50 hover:px-1.5"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">
                        {s.name}
                      </span>
                      <span className="text-[10px] text-fg-subtle">
                        {strat?.nameKo ?? s.strategyId} · {s.defaultSymbol.toUpperCase()}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-fg-subtle">
                      {fmtRelative(s.updatedAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  icon,
  title,
  count,
  countSuffix,
  href,
  ctaLabel,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  countSuffix?: string;
  href: string;
  ctaLabel: string;
  accent?: "up" | "down";
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "up"
      ? "border-[var(--color-up)]/40 bg-[var(--color-up)]/5"
      : accent === "down"
      ? "border-[var(--color-down)]/40 bg-[var(--color-down)]/5"
      : "border-line";
  return (
    <section className={`rounded-lg border bg-surface/30 ${accentClass}`}>
      <header className="flex items-baseline justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {icon}
          {title}
        </h2>
        <span className="text-[11px] tabular-nums text-fg-subtle">
          <span className="text-base font-semibold text-fg">{count}</span>
          {countSuffix && <span className="ml-0.5">{countSuffix}</span>}
        </span>
      </header>
      <div className="p-3">{children}</div>
      <footer className="border-t border-line px-3 py-1.5 text-right text-[11px]">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-fg-muted hover:text-fg"
        >
          {ctaLabel}
          <ArrowRight size={10} aria-hidden="true" />
        </Link>
      </footer>
    </section>
  );
}

function Empty({hint}: {hint: string}) {
  return (
    <p className="rounded-md border border-line bg-bg/40 p-3 text-center text-[11px] text-fg-subtle">
      {hint}
    </p>
  );
}

// references — TrendingUp/Down 은 향후 PnL indicator 등에 쓸 수 있게 import 만 유지.
void TrendingUp;
void TrendingDown;
