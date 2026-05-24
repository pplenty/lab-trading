import {describe, expect, it} from "vitest";
import {computePositions, type PaperTrade} from "./paper";

function mkTrade(
  overrides: Partial<PaperTrade> & {
    side: "buy" | "sell";
    units: number;
    price: number;
    createdAt: string;
  }
): PaperTrade {
  return {
    id: Math.random().toString(36),
    class: "us",
    symbol: "aapl",
    label: "Apple Inc.",
    currency: "USD",
    notes: undefined,
    ...overrides,
  };
}

describe("computePositions — paper trading", () => {
  it("단일 buy → position 1개, avgPrice = buy.price, units = buy.units", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p.length).toBe(1);
    expect(p[0].units).toBe(10);
    expect(p[0].avgPrice).toBe(100);
    expect(p[0].realizedPnl).toBe(0);
    expect(p[0].buyCount).toBe(1);
    expect(p[0].sellCount).toBe(0);
  });

  it("두 번 buy → avgPrice 가중평균", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({side: "buy", units: 20, price: 130, createdAt: "2024-01-02T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p[0].units).toBe(30);
    // (100×10 + 130×20) / 30 = (1000 + 2600) / 30 = 120
    expect(p[0].avgPrice).toBeCloseTo(120, 5);
    expect(p[0].buyCount).toBe(2);
  });

  it("buy → sell 일부 — units 차감 + realized PnL", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({side: "sell", units: 4, price: 130, createdAt: "2024-01-15T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p[0].units).toBe(6);
    expect(p[0].avgPrice).toBe(100); // 매도는 avgPrice 변경 X
    // (130 - 100) × 4 = 120
    expect(p[0].realizedPnl).toBeCloseTo(120, 5);
    expect(p[0].sellCount).toBe(1);
  });

  it("buy → 전량 sell — units 0, realized PnL 확정", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({side: "sell", units: 10, price: 150, createdAt: "2024-02-01T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p[0].units).toBe(0);
    expect(p[0].realizedPnl).toBeCloseTo(500, 5); // (150-100) × 10
  });

  it("보유 없는 sell 은 무시 (short 1차 미지원)", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "sell", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p.length).toBe(0);
  });

  it("초과 sell 은 보유분만 매도 (units floor 0)", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 5, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({side: "sell", units: 100, price: 120, createdAt: "2024-01-15T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p[0].units).toBe(0);
    expect(p[0].realizedPnl).toBeCloseTo(100, 5); // (120-100) × 5
  });

  it("재 진입 — 전량 sell 후 다시 buy → avgPrice 새 price", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({side: "sell", units: 10, price: 150, createdAt: "2024-02-01T00:00:00Z"}),
      mkTrade({side: "buy", units: 5, price: 200, createdAt: "2024-03-01T00:00:00Z"}),
    ];
    const p = computePositions(trades);
    expect(p[0].units).toBe(5);
    // units 0 상태에서 buy → totalCost = 0 + 200×5 = 1000, newUnits = 5, avg = 200
    expect(p[0].avgPrice).toBeCloseTo(200, 5);
    // realized PnL 누적 유지 (전량 sell 시 +500)
    expect(p[0].realizedPnl).toBeCloseTo(500, 5);
  });

  it("두 종목 동시 — 각각 position", () => {
    const trades: PaperTrade[] = [
      mkTrade({side: "buy", units: 10, price: 100, createdAt: "2024-01-01T00:00:00Z"}),
      mkTrade({
        side: "buy",
        units: 5,
        price: 200,
        createdAt: "2024-01-02T00:00:00Z",
        class: "crypto",
        symbol: "btc",
        label: "비트코인",
        currency: "KRW",
      }),
    ];
    const p = computePositions(trades);
    expect(p.length).toBe(2);
    const apple = p.find((x) => x.symbol === "aapl")!;
    const btc = p.find((x) => x.symbol === "btc")!;
    expect(apple.units).toBe(10);
    expect(btc.units).toBe(5);
    expect(btc.currency).toBe("KRW");
  });
});
