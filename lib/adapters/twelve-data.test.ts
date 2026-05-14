import {describe, expect, it} from "vitest";
import {
  normalizeTwelveCandle,
  normalizeTwelveQuote,
  twelveDataAdapter,
} from "./twelve-data";

describe("normalizeTwelveQuote", () => {
  it("parses string fields into typed Quote", () => {
    const q = normalizeTwelveQuote(
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        close: "220.50",
        change: "-1.20",
        percent_change: "-0.54",
        volume: "55000000",
        high: "222.10",
        low: "219.40",
        timestamp: 1715731199,
      },
      "aapl"
    );
    expect(q.symbol).toBe("aapl");
    expect(q.class).toBe("us");
    expect(q.currency).toBe("USD");
    expect(q.price).toBeCloseTo(220.5, 2);
    expect(q.changePct24h).toBeCloseTo(-0.54, 2);
    expect(q.volume24h).toBe(55_000_000);
  });
});

describe("normalizeTwelveCandle", () => {
  it("converts YYYY-MM-DD to UTC unix sec", () => {
    const c = normalizeTwelveCandle({
      datetime: "2026-05-14",
      open: "220.0",
      high: "222.5",
      low: "219.0",
      close: "221.8",
      volume: "55000000",
    });
    expect(c.t).toBe(Math.floor(Date.parse("2026-05-14T00:00:00Z") / 1000));
    expect(c.o).toBe(220);
    expect(c.h).toBe(222.5);
    expect(c.c).toBe(221.8);
  });
});

describe("twelveDataAdapter — demo mode (no API key)", () => {
  // 테스트 환경엔 TWELVE_DATA_API_KEY 미설정 → demo mode.

  it("listAssets returns 12 US tickers", async () => {
    const assets = await twelveDataAdapter.listAssets();
    expect(assets.length).toBe(12);
    expect(assets[0].class).toBe("us");
    expect(assets.find((a) => a.symbol === "aapl")?.name).toMatch(/Apple/);
  });

  it("getQuote returns deterministic price for same symbol", async () => {
    const q1 = await twelveDataAdapter.getQuote("aapl");
    const q2 = await twelveDataAdapter.getQuote("aapl");
    expect(q1.price).toBe(q2.price);
    expect(q1.changePct24h).toBe(q2.changePct24h);
    expect(q1.source).toMatch(/demo/);
    expect(q1.currency).toBe("USD");
  });

  it("different symbols produce different prices", async () => {
    const aapl = await twelveDataAdapter.getQuote("aapl");
    const tsla = await twelveDataAdapter.getQuote("tsla");
    expect(aapl.price).not.toBe(tsla.price);
  });

  it("getCandles returns deterministic series with monotonic timestamps", async () => {
    const a = await twelveDataAdapter.getCandles("aapl", {timeframe: "1d", limit: 50});
    const b = await twelveDataAdapter.getCandles("aapl", {timeframe: "1d", limit: 50});
    expect(a.candles.length).toBe(50);
    expect(a.candles).toEqual(b.candles);
    for (let i = 1; i < a.candles.length; i++) {
      expect(a.candles[i].t).toBeGreaterThan(a.candles[i - 1].t);
      // OHLC sanity: h >= max(o,c), l <= min(o,c)
      const c = a.candles[i];
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c));
    }
  });

  it("rankings sorts gainers by changePct24h desc", async () => {
    const r = await twelveDataAdapter.rankings!("gainers", {limit: 5});
    expect(r.length).toBe(5);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].changePct24h).toBeGreaterThanOrEqual(r[i].changePct24h);
    }
  });

  it("unknown symbol throws", async () => {
    await expect(twelveDataAdapter.getQuote("zzzz" as never)).rejects.toThrow();
  });
});
