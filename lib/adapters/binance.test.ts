import {describe, expect, it} from "vitest";
import {normalizeBinanceKline, normalizeBinanceTicker} from "./binance";

describe("normalizeBinanceKline", () => {
  it("converts ms to sec and parses string OHLCV", () => {
    const row: Parameters<typeof normalizeBinanceKline>[0] = [
      1715644800000, // openTime ms
      "60000.00",
      "61500.50",
      "59800.25",
      "61234.10",
      "1234.5678",
      1715731199999,
      "75000000.00",
      1500,
      "600.1234",
      "37000000.00",
      "0",
    ];
    const candle = normalizeBinanceKline(row);
    expect(candle.t).toBe(1715644800);
    expect(candle.o).toBeCloseTo(60000.0, 4);
    expect(candle.h).toBeCloseTo(61500.5, 4);
    expect(candle.l).toBeCloseTo(59800.25, 4);
    expect(candle.c).toBeCloseTo(61234.1, 4);
    expect(candle.v).toBeCloseTo(1234.5678, 4);
  });
});

describe("normalizeBinanceTicker", () => {
  it("parses Quote fields", () => {
    const quote = normalizeBinanceTicker(
      {
        symbol: "BTCUSDT",
        priceChange: "-1234.56",
        priceChangePercent: "-2.30",
        lastPrice: "59000.10",
        volume: "1200.5",
        quoteVolume: "70000000.0",
        highPrice: "62000",
        lowPrice: "58000",
        closeTime: 1715731199999,
      },
      "btc"
    );
    expect(quote.symbol).toBe("btc");
    expect(quote.class).toBe("crypto");
    expect(quote.currency).toBe("USDT");
    expect(quote.price).toBeCloseTo(59000.1, 4);
    expect(quote.changePct24h).toBeCloseTo(-2.3, 4);
    expect(quote.changeAbs24h).toBeCloseTo(-1234.56, 4);
    expect(quote.volume24h).toBeCloseTo(70_000_000, 4);
    expect(quote.high24h).toBe(62000);
    expect(quote.low24h).toBe(58000);
    expect(quote.source).toBe("binance");
    // ISO 8601 형식 검증
    expect(quote.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
