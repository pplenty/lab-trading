"use client";

import {useEffect, useRef} from "react";
import type {IChartApi, ISeriesApi} from "lightweight-charts";
import type {Candle} from "@/lib/types";

// TradingView Lightweight Charts v5 wrapper.
// dynamic import 로 38 KB 페이로드를 차트 가시 화면에서만 로드.
// CSS 변수 (--color-up / --color-down / --color-fg / --color-line / --bg) 를 차트 옵션에 매핑.
// 테마 / 모드 / 컬러 시맨틱 변경 시 차트도 갱신 — MutationObserver 로 :root dataset 변화 감지.
// showVolume 옵션 시 하단 ~20% 영역에 거래량 histogram (up/down 봉 컬러 매핑).

export type TradeMarker = {
  /** unix sec — candle.t 와 일치. */
  t: number;
  side: "buy" | "sell";
  /** hover 시 표시. */
  text?: string;
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
};

function readCssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

export function CandleChart({
  candles,
  height = 360,
  showVolume = false,
  visibleBars,
  trades,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      // volume histogram 색은 setData 시점에 박힘 — 테마 변경 시 재설정 (전체 candles 다시).
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

      // 거래량 histogram — 별도 priceScaleId 로 하단 영역 분리.
      if (showVolume) {
        volSeries = chart.addSeries(lw.HistogramSeries, {
          priceScaleId: "volume",
          priceFormat: {type: "volume"},
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: {top: 0.78, bottom: 0}, // 하단 22%
        });
        volSeries.setData(
          candles.map((c) => ({
            time: c.t as never,
            value: c.v,
            color: c.c >= c.o ? p.up : p.down,
          }))
        );
      }

      // trade markers — buy/sell 화살표를 캔들 아래/위에 박음.
      // lightweight-charts v5 의 createSeriesMarkers 사용.
      if (trades && trades.length > 0 && series) {
        const p = palette();
        const markers = trades
          .map((tr) => ({
            time: tr.t as never,
            position:
              tr.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
            color: tr.side === "buy" ? p.up : p.down,
            shape:
              tr.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
            text: tr.side === "buy" ? "B" : "S",
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));
        // v5: createSeriesMarkers(series, markers[])
        const cm = (lw as unknown as {createSeriesMarkers?: (s: unknown, m: unknown[]) => unknown})
          .createSeriesMarkers;
        if (typeof cm === "function") {
          cm(series, markers);
        }
      }

      // visibleBars 가 있으면 최근 N 봉만 viewport. 없으면 fit 전체.
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
  }, [candles, height, showVolume, visibleBars, trades]);

  return <div ref={containerRef} className="w-full" style={{height}} />;
}
