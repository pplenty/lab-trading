import type {Candle, IndicatorRow} from "@/lib/types";
import {
  atr,
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  volumeSma,
} from "@/lib/backtest/indicators";

// candles 배열 → IndicatorRow[] 일괄 계산 (ADR-0021).
// 사전계산 17 컬럼 (SMA 5/20/50/100/200, EMA 12/26/50, RSI 14, MACD 3, BB 3, ATR 14, VolSMA 20).
// 사용 측: backfill orchestrator (candles UPSERT 후 indicators UPSERT).

export const INDICATORS_VERSION = 1;

export function computeIndicators(candles: Candle[]): IndicatorRow[] {
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const volumes = candles.map((c) => c.v);

  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const macdSeries = macd(closes, 12, 26, 9);
  const bb = bollinger(closes, 20, 2);
  const atr14 = atr(highs, lows, closes, 14);
  const volSma20 = volumeSma(volumes, 20);

  return candles.map((c, i) => ({
    t: c.t,
    computed_version: INDICATORS_VERSION,
    sma_5: sma5[i],
    sma_20: sma20[i],
    sma_50: sma50[i],
    sma_100: sma100[i],
    sma_200: sma200[i],
    ema_12: ema12[i],
    ema_26: ema26[i],
    ema_50: ema50[i],
    rsi_14: rsi14[i],
    macd: macdSeries[i].macd,
    macd_signal: macdSeries[i].signal,
    macd_hist: macdSeries[i].hist,
    bb_upper: bb[i].upper,
    bb_middle: bb[i].middle,
    bb_lower: bb[i].lower,
    atr_14: atr14[i],
    vol_sma_20: volSma20[i],
  }));
}
