import {describe, expect, it} from "vitest";
import {normalizeCoinGeckoMarket} from "./coingecko";

describe("normalizeCoinGeckoMarket", () => {
  it("maps full market row to Quote (USD + marketCap + rank)", () => {
    const q = normalizeCoinGeckoMarket(
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
        current_price: 65000.5,
        market_cap: 1_300_000_000_000,
        market_cap_rank: 1,
        price_change_24h: -120.3,
        price_change_percentage_24h: -0.18,
        total_volume: 30_000_000_000,
        high_24h: 65500,
        low_24h: 64800,
        last_updated: "2026-05-15T03:00:00.000Z",
      },
      "btc"
    );
    expect(q.symbol).toBe("btc");
    expect(q.class).toBe("crypto");
    expect(q.currency).toBe("USD");
    expect(q.price).toBeCloseTo(65000.5, 4);
    expect(q.changePct24h).toBeCloseTo(-0.18, 4);
    expect(q.marketCap).toBe(1_300_000_000_000);
    expect(q.rank).toBe(1);
    expect(q.source).toBe("coingecko");
  });

  it("handles null high/low gracefully", () => {
    const q = normalizeCoinGeckoMarket(
      {
        id: "dogecoin",
        symbol: "doge",
        name: "Dogecoin",
        image: "",
        current_price: 0.15,
        market_cap: 20_000_000_000,
        market_cap_rank: 8,
        price_change_24h: 0,
        price_change_percentage_24h: 0,
        total_volume: 1_000_000_000,
        high_24h: null,
        low_24h: null,
        last_updated: "2026-05-15T00:00:00Z",
      },
      "doge"
    );
    expect(q.high24h).toBeUndefined();
    expect(q.low24h).toBeUndefined();
  });
});
