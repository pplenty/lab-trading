"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type {IChartApi, ISeriesApi} from "lightweight-charts";
import type {Candle} from "@/lib/types";

// TradingView Lightweight Charts v5 wrapper.
// dynamic import 로 38 KB 페이로드를 차트 가시 화면에서만 로드.
// CSS 변수 (--color-up / --color-down / --color-fg / --color-line / --bg) 를 차트 옵션에 매핑.
// 테마 / 모드 / 컬러 시맨틱 변경 시 차트도 갱신 — MutationObserver 로 :root dataset 변화 감지.
// showVolume 옵션 시 하단 ~20% 영역에 거래량 histogram (up/down 봉 컬러 매핑).
// ref → setHovered(t | null): trades 표 hover linkage 용 crosshair 강제 위치.

export type TradeMarker = {
  /** unix sec — candle.t 와 일치. */
  t: number;
  side: "buy" | "sell";
  /** hover 시 표시. */
  text?: string;
};

export type ChartOverlay = {
  /** unique id (e.g. "sma20"). 같은 id 는 update, 다르면 add/remove. */
  id: string;
  /** legend 표시명. */
  label: string;
  /** {t, v} — null/undefined 봉은 점선 끊김 처리. */
  points: Array<{t: number; v: number | null | undefined}>;
  /** hex 또는 CSS color. */
  color: string;
  /** 점선 (BB upper/lower 등). */
  dashed?: boolean;
};

export type ChartHandle = {
  /** time 을 지정하면 해당 봉 close 위치에 crosshair 표시. null 이면 해제. */
  setHovered: (t: number | null) => void;
};

type Props = {
  candles: Candle[];
  height?: number;
  /** 거래량 histogram 표시 (price chart 하단 ~20%). */
  showVolume?: boolean;
  /** 최근 N봉만 보이게 visibleLogicalRange — 데이터 전체 fetch 후 클라이언트 zoom. 미지정 시 fitContent. */
  visibleBars?: number;
  /** 매수/매도 마커 — 백테스트 결과에서 trades 전달 시 차트에 화살표 표시. */
  trades?: TradeMarker[];
  /** indicator overlay 라인 (SMA/EMA/Bollinger 등) — 사용자 토글 결과만 전달. */
  overlays?: ChartOverlay[];
};

function readCssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export const CandleChart = forwardRef<ChartHandle, Props>(function CandleChart(
  {candles, height = 360, showVolume = false, visibleBars, trades, overlays},
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const closesRef = useRef<Map<number, number>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
      setHovered: (t) => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;
        if (t === null) {
          chart.clearCrosshairPosition();
          return;
        }
        const close = closesRef.current.get(t);
        if (close === undefined) return;
        chart.setCrosshairPosition(close, t as never, series);
      },
    }),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Candlestick"> | null = null;
    let volSeries: ISeriesApi<"Histogram"> | null = null;

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
      if (volSeries) {
        volSeries.setData(
          candles.map((c) => ({
            time: c.t as never,
            value: c.v,
            color: c.c >= c.o ? p.up : p.down,
          }))
        );
      }
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

      series.setData(
        candles.map((c) => ({
          time: c.t as never,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        }))
      );

      // ref 노출용 — t → close 룩업
      closesRef.current = new Map(candles.map((c) => [c.t, c.c]));
      chartRef.current = chart;
      seriesRef.current = series;

      if (showVolume) {
        volSeries = chart.addSeries(lw.HistogramSeries, {
          priceScaleId: "volume",
          priceFormat: {type: "volume"},
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: {top: 0.78, bottom: 0},
        });
        volSeries.setData(
          candles.map((c) => ({
            time: c.t as never,
            value: c.v,
            color: c.c >= c.o ? p.up : p.down,
          }))
        );
      }

      if (trades && trades.length > 0 && series) {
        const pp = palette();
        const markers = trades
          .map((tr) => ({
            time: tr.t as never,
            position:
              tr.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
            color: tr.side === "buy" ? pp.up : pp.down,
            shape:
              tr.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
            text: tr.side === "buy" ? "B" : "S",
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        const cm = (
          lw as unknown as {
            createSeriesMarkers?: (s: unknown, m: unknown[]) => unknown;
          }
        ).createSeriesMarkers;
        if (typeof cm === "function") {
          cm(series, markers);
        }
      }

      // overlays — indicator lines (SMA/EMA/BB 등). lightweight-charts v5 의 whitespace
      // 처리: value null/undefined 봉은 series 가 자동으로 line 끊김 처리.
      if (overlays && overlays.length > 0) {
        for (const ov of overlays) {
          const lineSeries = chart.addSeries(lw.LineSeries, {
            color: ov.color,
            lineWidth: 1,
            lineStyle: ov.dashed ? 2 : 0, // 2 = LineStyle.Dashed
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
          const data = ov.points
            .filter((p) => p.v !== null && p.v !== undefined && Number.isFinite(p.v))
            .map((p) => ({time: p.t as never, value: p.v as number}));
          if (data.length > 0) lineSeries.setData(data);
        }
      }

      if (visibleBars && visibleBars > 0 && candles.length > visibleBars) {
        const total = candles.length;
        chart.timeScale().setVisibleLogicalRange({
          from: total - visibleBars,
          to: total,
        });
      } else {
        chart.timeScale().fitContent();
      }
    })();

    const onResize = () => {
      if (chart && container) {
        chart.applyOptions({width: container.clientWidth});
      }
    };
    window.addEventListener("resize", onResize);

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
      chartRef.current = null;
      seriesRef.current = null;
      closesRef.current = new Map();
      chart?.remove();
    };
  }, [candles, height, showVolume, visibleBars, trades, overlays]);

  return <div ref={containerRef} className="w-full" style={{height}} />;
});
