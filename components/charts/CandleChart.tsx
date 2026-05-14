"use client";

import {useEffect, useRef} from "react";
import type {IChartApi, ISeriesApi} from "lightweight-charts";
import type {Candle} from "@/lib/types";

// TradingView Lightweight Charts v5 wrapper.
// dynamic import 로 38 KB 페이로드를 차트 가시 화면에서만 로드.
// CSS 변수 (--color-up / --color-down / --color-fg / --color-line / --bg) 를 차트 옵션에 매핑.
// 테마 / 모드 / 컬러 시맨틱 변경 시 차트도 갱신 — MutationObserver 로 :root dataset 변화 감지.

type Props = {
  candles: Candle[];
  height?: number;
};

function readCssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function CandleChart({candles, height = 360}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Candlestick"> | null = null;

    const palette = () => {
      const root = document.documentElement;
      return {
        up: readCssVar(root, "--color-up") || "#22c55e",
        down: readCssVar(root, "--color-down") || "#ef4444",
        fg: readCssVar(root, "--fg") || "#0f172a",
        line: readCssVar(root, "--line") || "#e2e8f0",
        bg: readCssVar(root, "--bg") || "#ffffff",
      };
    };

    const applyPalette = () => {
      if (!chart || !series) return;
      const p = palette();
      chart.applyOptions({
        layout: {background: {color: p.bg}, textColor: p.fg},
        grid: {
          vertLines: {color: p.line},
          horzLines: {color: p.line},
        },
      });
      series.applyOptions({
        upColor: p.up,
        downColor: p.down,
        borderUpColor: p.up,
        borderDownColor: p.down,
        wickUpColor: p.up,
        wickDownColor: p.down,
      });
    };

    (async () => {
      const lw = await import("lightweight-charts");
      if (cancelled || !container) return;

      const p = palette();
      chart = lw.createChart(container, {
        width: container.clientWidth,
        height,
        layout: {background: {color: p.bg}, textColor: p.fg},
        grid: {
          vertLines: {color: p.line},
          horzLines: {color: p.line},
        },
        rightPriceScale: {borderColor: p.line},
        timeScale: {borderColor: p.line, timeVisible: false, secondsVisible: false},
        autoSize: false,
      });

      series = chart.addSeries(lw.CandlestickSeries, {
        upColor: p.up,
        downColor: p.down,
        borderUpColor: p.up,
        borderDownColor: p.down,
        wickUpColor: p.up,
        wickDownColor: p.down,
      });

      // lightweight-charts 는 time 으로 UTCTimestamp (unix sec) 또는 'YYYY-MM-DD'. 일봉이면 sec 으로 OK.
      series.setData(
        candles.map((c) => ({
          time: c.t as never,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        }))
      );
      chart.timeScale().fitContent();
    })();

    const onResize = () => {
      if (chart && container) {
        chart.applyOptions({width: container.clientWidth});
      }
    };
    window.addEventListener("resize", onResize);

    // 테마/모드/컬러 시맨틱 변경 감지 — :root dataset 또는 inline style 변화.
    const root = document.documentElement;
    const observer = new MutationObserver(() => applyPalette());
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-mode", "data-color-semantics", "style"],
    });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      chart?.remove();
    };
  }, [candles, height]);

  return <div ref={containerRef} className="w-full" style={{height}} />;
}
