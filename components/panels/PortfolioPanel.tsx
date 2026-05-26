"use client";

import {useEffect, useMemo, useState} from "react";
import {Briefcase, Trash2, ExternalLink, RefreshCw, LineChart as LineIcon} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {useTrades, type PaperPosition} from "@/lib/paper";
import {useSnapshots} from "@/lib/portfolio-snapshots";
import {FinancialDelta} from "@/components/FinancialDelta";
import {LineChart, type LineSeries} from "@/components/charts/LineChart";
import type {Quote} from "@/lib/types";

// 가상 포트폴리오 통합 페이지 — 보유 종목 + per-symbol PnL + 거래 이력.
// client 가 보유 종목 list → /api/portfolio-quotes batch fetch.

type QuotesMap = Record<string, Quote | null>;

function fmtPrice(p: number, currency: string): string {
  if (currency === "KRW") return `₩${p.toLocaleString("ko-KR")}`;
  if (currency === "USD")
    return `$${p.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
  return p.toLocaleString();
}

export function PortfolioPanel() {
  const {positions, items, remove} = useTrades();
  const {snapshots, record, clear: clearSnapshots} = useSnapshots();
  const [quotes, setQuotes] = useState<QuotesMap>({});
  const [loading, setLoading] = useState(false);

  const holdingSymbols = useMemo(
    () => positions.filter((p) => p.units > 0),
    [positions]
  );
  const closedSymbols = useMemo(
    () => positions.filter((p) => p.units === 0),
    [positions]
  );

  // 종목 변경 시 quotes batch fetch
  const symbolsKey = holdingSymbols.map((p) => `${p.class}:${p.symbol}`).join(",");

  useEffect(() => {
    if (symbolsKey === "") {
      setQuotes({});
      return;
    }
    fetchQuotes(symbolsKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  async function fetchQuotes(syms: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/portfolio-quotes?symbols=${encodeURIComponent(syms)}`,
        {cache: "no-store"}
      );
      if (!res.ok) return;
      const data = (await res.json()) as {quotes: QuotesMap};
      setQuotes(data.quotes ?? {});
    } catch {
      // swallow
    } finally {
      setLoading(false);
    }
  }

  // 통화별 합계
  const totals = useMemo(() => {
    const t: Record<string, {invested: number; current: number; realized: number}> = {};
    for (const p of positions) {
      const cur = quotes[`${p.class}:${p.symbol}`]?.price;
      const t0 = t[p.currency] ?? {invested: 0, current: 0, realized: 0};
      t0.invested += p.avgPrice * p.units;
      t0.current += (cur ?? p.avgPrice) * p.units;
      t0.realized += p.realizedPnl;
      t[p.currency] = t0;
    }
    return t;
  }, [positions, quotes]);

  // quotes 가 fetched 되면 (or holding 변경) 일별 snapshot 기록.
  // dedup: 같은 day 면 덮어쓰기 (intraday 최신화).
  const holdingCount = useMemo(() => positions.filter((p) => p.units > 0).length, [positions]);
  const totalsSig = useMemo(() => JSON.stringify(totals), [totals]);
  useEffect(() => {
    // quotes 가 아직 안 왔으면 (loading) skip — invested 만 있는 stale snapshot 회피.
    // 단, holdings 0 인 경우는 realized 만 있어도 기록 OK.
    if (holdingCount > 0 && Object.keys(quotes).length === 0) return;
    const valueByCurrency: Record<string, number> = {};
    const realizedByCurrency: Record<string, number> = {};
    for (const [curr, t] of Object.entries(totals)) {
      valueByCurrency[curr] = t.current;
      realizedByCurrency[curr] = t.realized;
    }
    record({valueByCurrency, realizedByCurrency, holdingCount});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalsSig, holdingCount]);

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <Briefcase
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">가상 매매 기록이 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          종목 상세 페이지 헤더의{" "}
          <span className="inline-flex h-5 items-center gap-1 rounded-md border border-line bg-bg px-1.5 align-middle text-[10px] text-fg-subtle">
            💼 가상매매
          </span>{" "}
          버튼으로 첫 거래를 기록해보세요.
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
    <div className="flex flex-col gap-6">
      {/* Timeline — 일별 snapshot 추적 */}
      {snapshots.length >= 2 && (
        <SnapshotTimeline snapshots={snapshots} onClear={clearSnapshots} />
      )}

      {/* 통화별 요약 */}
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <header className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-fg">통화별 요약</h2>
          <button
            type="button"
            onClick={() => fetchQuotes(symbolsKey)}
            disabled={loading || symbolsKey === ""}
            aria-label="시세 새로고침"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] text-fg-muted transition-colors hover:border-fg hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={11}
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
            />
            새로고침
          </button>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(totals).map(([curr, t]) => {
            const unrealized = t.current - t.invested;
            const unrealizedPct = t.invested > 0 ? (unrealized / t.invested) * 100 : 0;
            const totalPnl = unrealized + t.realized;
            return (
              <div
                key={curr}
                className="rounded-md border border-line bg-bg p-3 text-xs"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-semibold text-fg">{curr}</span>
                  <span className="text-[10px] text-fg-subtle">
                    {holdingSymbols.filter((p) => p.currency === curr).length} 보유
                    {" · "}
                    {closedSymbols.filter((p) => p.currency === curr).length} 종료
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-fg-subtle">매입원가</span>
                  <span className="text-right tabular-nums text-fg-muted">
                    {fmtPrice(t.invested, curr)}
                  </span>
                  <span className="text-fg-subtle">평가액</span>
                  <span className="text-right tabular-nums text-fg">
                    {fmtPrice(t.current, curr)}
                  </span>
                  <span className="text-fg-subtle">미실현</span>
                  <span className="text-right">
                    <FinancialDelta
                      changePct={unrealizedPct}
                      changeAbs={unrealized}
                      currency={curr}
                      digits={2}
                    />
                  </span>
                  <span className="text-fg-subtle">확정</span>
                  <span
                    className={
                      "text-right tabular-nums " +
                      (t.realized > 0
                        ? "text-[var(--color-up)]"
                        : t.realized < 0
                        ? "text-[var(--color-down)]"
                        : "text-fg-subtle")
                    }
                  >
                    {t.realized > 0 ? "+" : ""}
                    {fmtPrice(t.realized, curr)}
                  </span>
                  <span className="border-t border-line/40 pt-1 text-fg-subtle">
                    총 PnL
                  </span>
                  <span
                    className={
                      "border-t border-line/40 pt-1 text-right text-base font-semibold tabular-nums " +
                      (totalPnl > 0
                        ? "text-[var(--color-up)]"
                        : totalPnl < 0
                        ? "text-[var(--color-down)]"
                        : "text-fg")
                    }
                  >
                    {totalPnl > 0 ? "+" : ""}
                    {fmtPrice(totalPnl, curr)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 보유 종목 */}
      <section className="rounded-lg border border-line">
        <header className="border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          보유 중 ({holdingSymbols.length})
        </header>
        {holdingSymbols.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-fg-muted">
            현재 보유 중인 종목 없음
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {holdingSymbols.map((p) => (
              <PositionRow
                key={`${p.class}:${p.symbol}`}
                position={p}
                currentPrice={quotes[`${p.class}:${p.symbol}`]?.price}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 종료 종목 (units == 0) */}
      {closedSymbols.length > 0 && (
        <section className="rounded-lg border border-line">
          <header className="border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            종료 ({closedSymbols.length}) · 확정 PnL
          </header>
          <ul className="divide-y divide-line">
            {closedSymbols.map((p) => (
              <ClosedRow key={`${p.class}:${p.symbol}`} position={p} />
            ))}
          </ul>
        </section>
      )}

      {/* 전체 거래 이력 */}
      <section className="rounded-lg border border-line">
        <header className="flex items-baseline justify-between border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          전체 거래 ({items.length})
        </header>
        <ul className="divide-y divide-line">
          {items.slice(0, 50).map((t) => (
            <li
              key={t.id}
              className={
                "flex items-center justify-between gap-3 px-4 py-2 text-xs " +
                (t.side === "buy"
                  ? "border-l-2 border-l-[var(--color-up)]"
                  : "border-l-2 border-l-[var(--color-down)]")
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/${t.class}/${t.symbol}`}
                  className="truncate text-sm font-medium text-fg hover:text-accent"
                >
                  {t.label}
                </Link>
                <span className="text-[10px] text-fg-subtle">
                  {t.symbol.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 tabular-nums">
                <span
                  className={
                    "text-[11px] font-medium " +
                    (t.side === "buy"
                      ? "text-[var(--color-up)]"
                      : "text-[var(--color-down)]")
                  }
                >
                  {t.side === "buy" ? "매수" : "매도"} {t.units}
                </span>
                <span className="text-fg-muted">
                  @ {fmtPrice(t.price, t.currency)}
                </span>
                <span className="text-[10px] text-fg-subtle">
                  {new Date(t.createdAt).toLocaleDateString("ko-KR")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("이 거래 기록을 삭제할까요?")) remove(t.id);
                  }}
                  aria-label="거래 삭제"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
                >
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PositionRow({
  position,
  currentPrice,
}: {
  position: PaperPosition;
  currentPrice?: number;
}) {
  const cur = currentPrice ?? position.avgPrice;
  const unrealized = (cur - position.avgPrice) * position.units;
  const unrealizedPct =
    position.avgPrice > 0
      ? ((cur - position.avgPrice) / position.avgPrice) * 100
      : 0;

  return (
    <li className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/${position.class}/${position.symbol}`}
          className="flex items-baseline gap-2 text-sm font-semibold text-fg hover:text-accent"
        >
          {position.label}
          <span className="text-[11px] font-normal text-fg-subtle">
            {position.symbol.toUpperCase()}
          </span>
          <ExternalLink size={10} aria-hidden="true" className="text-fg-subtle" />
        </Link>
        <span className="text-[11px] text-fg-muted tabular-nums">
          {position.units} units
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3 text-[11px]">
        <Cell label="평단가" value={fmtPrice(position.avgPrice, position.currency)} />
        <Cell
          label="현재가"
          value={currentPrice !== undefined ? fmtPrice(currentPrice, position.currency) : "—"}
          subtle={currentPrice === undefined}
        />
        <Cell
          label="평가액"
          value={fmtPrice(cur * position.units, position.currency)}
        />
        <div>
          <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
            미실현 PnL
          </div>
          <div className="mt-0.5 text-right tabular-nums">
            <FinancialDelta
              changePct={unrealizedPct}
              changeAbs={unrealized}
              currency={position.currency}
              digits={2}
            />
          </div>
        </div>
      </div>
      {position.realizedPnl !== 0 && (
        <p className="mt-1.5 text-[10px] text-fg-subtle">
          확정 PnL{" "}
          <span
            className={
              "tabular-nums " +
              (position.realizedPnl > 0
                ? "text-[var(--color-up)]"
                : "text-[var(--color-down)]")
            }
          >
            {position.realizedPnl > 0 ? "+" : ""}
            {fmtPrice(position.realizedPnl, position.currency)}
          </span>{" "}
          · 매수 {position.buyCount}회 · 매도 {position.sellCount}회
        </p>
      )}
    </li>
  );
}

function ClosedRow({position}: {position: PaperPosition}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
      <Link
        href={`/${position.class}/${position.symbol}`}
        className="flex items-baseline gap-2 text-sm text-fg hover:text-accent"
      >
        {position.label}
        <span className="text-[11px] text-fg-subtle">
          {position.symbol.toUpperCase()}
        </span>
      </Link>
      <div className="flex items-center gap-3 tabular-nums text-[11px]">
        <span className="text-fg-subtle">
          {position.buyCount} buy · {position.sellCount} sell
        </span>
        <span
          className={
            "font-semibold " +
            (position.realizedPnl > 0
              ? "text-[var(--color-up)]"
              : position.realizedPnl < 0
              ? "text-[var(--color-down)]"
              : "text-fg-muted")
          }
        >
          {position.realizedPnl > 0 ? "+" : ""}
          {fmtPrice(position.realizedPnl, position.currency)}
        </span>
      </div>
    </li>
  );
}

function Cell({label, value, subtle}: {label: string; value: string; subtle?: boolean}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-right tabular-nums " +
          (subtle ? "text-fg-subtle" : "text-fg")
        }
      >
        {value}
      </div>
    </div>
  );
}

// 통화별 색상 — 최대 4종.
const CURRENCY_COLOR: Record<string, string> = {
  KRW: "#2563eb", // blue
  USD: "#16a34a", // green
  JPY: "#ca8a04", // amber
  EUR: "#a855f7", // purple
};

function SnapshotTimeline({
  snapshots,
  onClear,
}: {
  snapshots: ReturnType<typeof useSnapshots>["snapshots"];
  onClear: () => void;
}) {
  // 통화별 시계열 분리
  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const s of snapshots) {
      for (const c of Object.keys(s.valueByCurrency)) set.add(c);
    }
    return Array.from(set);
  }, [snapshots]);

  const series = useMemo<LineSeries[]>(() => {
    return currencies.map((curr) => {
      // value + realized 합 = 총 자산 (현금 + 미실현 + 확정)
      // 단순화: value (현재 평가액) 만 사용 — 시간 흐름이 핵심.
      const points = snapshots
        .map((s) => {
          const value = s.valueByCurrency[curr] ?? 0;
          const realized = s.realizedByCurrency[curr] ?? 0;
          return {
            t: Math.floor(new Date(`${s.day}T00:00:00Z`).getTime() / 1000),
            v: value + realized,
          };
        })
        .filter((p) => Number.isFinite(p.v));
      return {
        label: `${curr} 총 자산`,
        points,
        color: CURRENCY_COLOR[curr] ?? "#94a3b8",
      };
    });
  }, [currencies, snapshots]);

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const daySpan =
    Math.floor(
      (new Date(`${last.day}T00:00:00Z`).getTime() -
        new Date(`${first.day}T00:00:00Z`).getTime()) /
        (86400 * 1000)
    ) + 1;

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <LineIcon size={14} aria-hidden="true" className="text-fg-muted" />
          포트폴리오 추이
        </h2>
        <div className="flex items-baseline gap-3 text-[11px] text-fg-subtle">
          <span>
            {first.day} → {last.day} ({snapshots.length}일 / {daySpan}일 범위)
          </span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("저장된 일별 snapshot 을 모두 삭제할까요?")) {
                onClear();
              }
            }}
            className="text-[10px] text-fg-subtle hover:text-[var(--color-down)]"
          >
            기록 초기화
          </button>
        </div>
      </header>

      <LineChart series={series} height={180} ariaLabel="포트폴리오 일별 추이" />

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
        {currencies.map((curr) => {
          const points = series.find((s) => s.label.startsWith(curr))?.points ?? [];
          if (points.length < 2) return null;
          const f = points[0].v;
          const l = points[points.length - 1].v;
          const pct = f > 0 ? ((l - f) / f) * 100 : 0;
          return (
            <span key={curr} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{background: CURRENCY_COLOR[curr] ?? "#94a3b8"}}
              />
              <span className="text-fg-muted">{curr}</span>
              <span className="tabular-nums">
                <FinancialDelta changePct={pct} digits={2} />
              </span>
            </span>
          );
        })}
        <span className="ml-auto text-fg-subtle">총 자산 = 평가액 + 확정 PnL</span>
      </div>
    </section>
  );
}
