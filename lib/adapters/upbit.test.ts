import {describe, expect, it} from "vitest";
import {normalizeUpbitCandle, normalizeUpbitTicker} from "./upbit";

describe("normalizeUpbitTicker", () => {
  it("converts signed_change_rate to percent and pulls KRW fields", () => {
    const quote = normalizeUpbitTicker(
      {
        market: "KRW-BTC",
        trade_price: 85_000_000,
        prev_closing_price: 84_300_000,
        change: "RISE",
        signed_change_price: 700_000,
        signed_change_rate: 0.0083,
        acc_trade_price_24h: 1.2e10,
        high_price: 86_500_000,
        low_price: 84_000_000,
        trade_timestamp: 1715731199000,
      },
      "btc"
    );
    expect(quote.symbol).toBe("btc");
    expect(quote.class).toBe("crypto");
    expect(quote.currency).toBe("KRW");
    expect(quote.price).toBe(85_000_000);
    expect(quote.changePct24h).toBeCloseTo(0.83, 4);
    expect(quote.changeAbs24h).toBe(700_000);
    expect(quote.volume24h).toBe(1.2e10);
    expect(quote.source).toBe("upbit");
  });
});

describe("normalizeUpbitCandle", () => {
  it("converts ISO UTC string (no Z) to unix sec", () => {
    const candle = normalizeUpbitCandle({
      market: "KRW-BTC",
      candle_date_time_utc: "2026-05-14T00:00:00",
      opening_price: 85_000_000,
      high_price: 86_500_000,
      low_price: 84_000_000,
      trade_price: 86_000_000,
      candle_acc_trade_volume: 152.34,
      timestamp: 1715731199000,
    });
    // 2026-05-14T00:00:00Z = 1763078400
    expect(candle.t).toBe(Math.floor(Date.parse("2026-05-14T00:00:00Z") / 1000));
    expect(candle.o).toBe(85_000_000);
    expect(candle.h).toBe(86_500_000);
    expect(candle.l).toBe(84_000_000);
    expect(candle.c).toBe(86_000_000);
    expect(candle.v).toBeCloseTo(152.34, 4);
  });
});
