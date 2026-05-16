import type {Candle, IndicatorRow} from "@/lib/types";
import {
  adx,
  atr,
  bollinger,
  cci,
  ema,
  macd,
  obv,
  roc,
  rsi,
  sma,
  stochastic,
  volumeSma,
  williamsR,
} from "@/lib/backtest/indicators";

// candles 배열 → IndicatorRow[] 일괄 계산 (ADR-0021).
// 사전계산 26 컬럼 (Phase 2):
//   SMA 5/20/50/100/200, EMA 12/26/50, RSI 14, MACD 3, BB 3, ATR 14, VolSMA 20
//   + Stochastic K/D, CCI 20, Williams %R 14, ADX/DI+/DI- 14, OBV, ROC 12
//
// INDICATORS_VERSION 을 1 → 2 로 올림 — 같은 (symbol, t) row 라도 version 다르면 재계산.
// version 1 데이터는 그대로 둘 수도 있지만 본 프로젝트는 단일 latest version 만 유지 (recompute route 로 일괄 갱신).

export const INDICATORS_VERSION = 2;

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
  // 신규 9 컬럼
  const stoch = stochastic(highs, lows, closes, 14, 3);
  const cci20 = cci(highs, lows, closes, 20);
  const willR14 = williamsR(highs, lows, closes, 14);
  const adx14 = adx(highs, lows, closes, 14);
  const obvSeries = obv(closes, volumes);
  const roc12 = roc(closes, 12);

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
    stoch_k_14_3: stoch.k[i],
    stoch_d_14_3: stoch.d[i],
    cci_20: cci20[i],
    williams_r_14: willR14[i],
    adx_14: adx14.adx[i],
    di_plus_14: adx14.plus[i],
    di_minus_14: adx14.minus[i],
    obv: obvSeries[i],
    roc_12: roc12[i],
  }));
}
