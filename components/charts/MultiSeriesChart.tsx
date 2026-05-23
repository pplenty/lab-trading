"use client";

import {useEffect, useRef} from "react";
import type {IChartApi, ISeriesApi} from "lightweight-charts";

// 다중 종목 normalized 비교 차트 — lightweight-charts multi line series.
// 종목별 색은 prop 으로 지정 (palette). first/last 기반 자동 색 분기 X
// (비교 차트는 종목별 fixed 색이 가독성 ↑).

export type CompareLine = {
  label: string;
  /** [{t (unix sec), v (normalized 100 기준)}] */
  points: Array<{t: number; v: number}>;
  /** CSS color (hex 또는 var(--...)). */
  color: string;
};

type Props = {
  lines: CompareLine[];
  height?: number;
};

function readCssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function MultiSeriesChart({lines, height = 360}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let chart: IChartApi | null = null;
    const seriesList: ISeriesApi<"Line">[] = [];

    (async () => {
      const lw = await import("lightweight-charts");
      if (cancelled || !container) return;

      const root = document.documentElement;
      const fg = readCssVar(root, "--fg") || "#0f172a";
      const line = readCssVar(root, "--line") || "#e2e8f0";
      const bg = readCssVar(root, "--bg") || "#ffffff";

      chart = lw.createChart(container, {
        width: container.clientWidth,
        height,
        layout: {background: {color: bg}, textColor: fg},
        grid: {
          vertLines: {color: line},
          horzLines: {color: line},
        },
        rightPriceScale: {borderColor: line},
        timeScale: {
          borderColor: line,
          timeVisible: false,
          secondsVisible: false,
        },
        autoSize: false,
      });

      for (const ln of lines) {
        if (ln.points.length < 2) continue;
        const series = chart.addSeries(lw.LineSeries, {
          color: ln.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
        series.setData(
          ln.points.map((p) => ({time: p.t as never, value: p.v}))
        );
        seriesList.push(series);
      }

      chart.timeScale().fitContent();
    })();

    const onResize = () => {
      if (chart && container) {
        chart.applyOptions({width: container.clientWidth});
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      chart?.remove();
    };
  }, [lines, height]);

  return <div ref={containerRef} className="w-full" style={{height}} />;
}
