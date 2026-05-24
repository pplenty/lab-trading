"use client";

import {useRef} from "react";
import {CandleChart, type ChartHandle, type TradeMarker} from "@/components/charts/CandleChart";
import {TradesTable} from "./TradesTable";
import type {Trade} from "@/lib/backtest/types";
import type {Candle} from "@/lib/types";

// 백테스트 매매 시그널 차트 + 거래 내역 표 — hover linkage.
// table row hover → chart crosshair 강제 위치로 "이 시점이 어디인지" 시각화.

type Props = {
  candles: Candle[];
  trades: Trade[];
  currency: string;
};

export function InteractiveBacktestTrades({candles, trades, currency}: Props) {
  const chartRef = useRef<ChartHandle>(null);

  const buyCount = trades.filter((t) => t.side === "buy").length;
  const sellCount = trades.filter((t) => t.side === "sell").length;

  return (
    <>
      <section className="rounded-lg border border-line bg-surface/30 p-4">
        <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <h3 className="text-sm font-semibold text-fg">매매 시그널</h3>
          <div className="flex items-center gap-3 text-fg-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-up)]" />
              매수 {buyCount}회
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-down)]" />
              매도 {sellCount}회
            </span>
          </div>
        </header>
        <CandleChart
          ref={chartRef}
          candles={candles}
          height={260}
          trades={
            trades.map((t) => ({
              t: t.t,
              side: t.side,
              text: t.reason,
            })) as TradeMarker[]
          }
        />
        <p className="mt-2 text-[10px] text-fg-subtle">
          ▲ 매수 · ▼ 매도 — 아래 <span className="font-medium text-fg-muted">거래 내역</span> row 위에 마우스를 올리면 해당 시점이 차트에 표시됩니다
        </p>
      </section>

      <TradesTable
        trades={trades}
        currency={currency}
        maxRows={20}
        onRowHover={(t) => chartRef.current?.setHovered(t)}
      />
    </>
  );
}
