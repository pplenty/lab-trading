"use client";

import {Download} from "lucide-react";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {Trade} from "@/lib/backtest/types";
import {pairRoundTrips} from "@/lib/backtest/round-trips";
import {tradesToCsv} from "@/lib/backtest/trades-csv";

// 백테스트 거래 목록 — 매수/매도 페어로 묶어 round-trip PnL 노출.
// 매수만 있고 매도 없는 마지막 trade (open position) 도 표시 (PnL "—").
// onRowHover: 부모 (InteractiveBacktestTrades) 가 차트 crosshair 연동.

type Props = {
  trades: Trade[];
  currency: string;
  /** 표시할 최대 round-trip 수 (default 20). */
  maxRows?: number;
  /** row hover 시 매수 봉 timestamp. leave 시 null. */
  onRowHover?: (t: number | null) => void;
  /** CSV 파일명 prefix (예: "btc-sma-cross"). default "backtest". */
  exportName?: string;
};

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

function priceFmt(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
    minimumFractionDigits: currency === "KRW" ? 0 : 2,
  });
}

export function TradesTable({
  trades,
  currency,
  maxRows = 20,
  onRowHover,
  exportName = "backtest",
}: Props) {
  const trips = pairRoundTrips(trades);

  function handleExport() {
    const csv = tradesToCsv(trades);
    // BOM (﻿) 선두 — Excel 이 UTF-8 한글 사유 컬럼 정상 인식.
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}-trades.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (trips.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/30 p-4 text-sm text-fg-muted">
        체결된 거래가 없습니다. 전략 파라미터를 조정해 보세요.
      </section>
    );
  }

  // 최근 순 (최신이 위) 으로 정렬
  const visible = [...trips].reverse().slice(0, maxRows);
  const fmt = priceFmt(currency);

  const anyReason = visible.some((t) => t.buy.reason || t.sell?.reason);

  return (
    <section className="rounded-lg border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          거래 내역 ({trips.length} round-trip · 최근 {visible.length}건)
        </span>
        <button
          type="button"
          onClick={handleExport}
          aria-label="거래 내역 전체 CSV 내보내기"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <Download size={12} aria-hidden="true" />
          CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-fg-subtle">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">매수</th>
              <th className="px-4 py-2 text-right font-medium">매수가</th>
              <th className="px-4 py-2 text-left font-medium">매도</th>
              <th className="px-4 py-2 text-right font-medium">매도가</th>
              <th className="px-4 py-2 text-right font-medium">PnL</th>
              <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
                Hold
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((trip, i) => {
              const idx = trips.length - i;
              const open = trip.sell === null;
              const buyReason = trip.buy.reason;
              const sellReason = trip.sell?.reason;
              return (
                <>
                  <tr
                    key={`${trip.buy.t}-${idx}`}
                    onMouseEnter={onRowHover ? () => onRowHover(trip.buy.t) : undefined}
                    onMouseLeave={onRowHover ? () => onRowHover(null) : undefined}
                    className={
                      "border-t border-line tabular-nums" +
                      (onRowHover ? " cursor-pointer transition-colors hover:bg-surface/50" : "")
                    }
                  >
                    <td className="px-4 py-2 text-fg-subtle">{idx}</td>
                    <td className="px-4 py-2 text-fg-muted">
                      {dateFmt.format(new Date(trip.buy.t * 1000))}
                    </td>
                    <td className="px-4 py-2 text-right text-fg">
                      {fmt.format(trip.buy.price)}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">
                      {trip.sell ? dateFmt.format(new Date(trip.sell.t * 1000)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-fg">
                      {trip.sell ? fmt.format(trip.sell.price) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {trip.pnlPct === null ? (
                        <span className="text-fg-subtle">
                          {open ? "open" : "—"}
                        </span>
                      ) : (
                        <FinancialDelta changePct={trip.pnlPct} digits={2} />
                      )}
                    </td>
                    <td className="hidden px-4 py-2 text-right text-fg-muted sm:table-cell">
                      {trip.holdDays !== null
                        ? `${trip.holdDays.toFixed(0)}d`
                        : "—"}
                    </td>
                  </tr>
                  {(buyReason || sellReason) && (
                    <tr
                      key={`${trip.buy.t}-${idx}-reason`}
                      className="border-t border-line/50 bg-surface/20 text-[11px]"
                    >
                      <td className="px-4 py-2 text-fg-subtle" colSpan={1}></td>
                      <td className="px-4 py-1.5 text-fg-subtle" colSpan={2}>
                        {buyReason && (
                          <span className="inline-flex items-baseline gap-1">
                            <span className="text-[10px] font-medium text-[var(--color-up)]">▲ 매수</span>
                            <span className="text-fg-muted">{buyReason}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-fg-subtle" colSpan={3}>
                        {sellReason && (
                          <span className="inline-flex items-baseline gap-1">
                            <span className="text-[10px] font-medium text-[var(--color-down)]">▼ 매도</span>
                            <span className="text-fg-muted">{sellReason}</span>
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-2 sm:table-cell" colSpan={1}></td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {trips.length > maxRows && (
        <div className="border-t border-line bg-bg/40 px-4 py-2 text-[11px] text-fg-subtle">
          +{trips.length - maxRows}건 더 — 전체는 위 <span className="font-medium text-fg-muted">CSV</span> 버튼으로 내보내세요.
        </div>
      )}
      {!anyReason && (
        <div className="border-t border-line bg-bg/40 px-4 py-2 text-[11px] text-fg-subtle">
          이 전략은 신호 사유를 제공하지 않습니다.
        </div>
      )}
    </section>
  );
}
