import {describe, expect, it} from "vitest";
import {kisAdapter} from "./kis";

describe("kisAdapter — demo mode (no API key)", () => {
  it("listAssets returns 12 KR tickers", async () => {
    const assets = await kisAdapter.listAssets();
    expect(assets.length).toBe(12);
    expect(assets[0].class).toBe("kr");
    expect(assets[0].currency).toBe("KRW");
    expect(assets.find((a) => a.symbol === "005930")?.nameKo).toBe("삼성전자");
  });

  it("getQuote returns deterministic KRW price with quantized integer", async () => {
    const q1 = await kisAdapter.getQuote("005930");
    const q2 = await kisAdapter.getQuote("005930");
    expect(q1.price).toBe(q2.price);
    expect(Number.isInteger(q1.price)).toBe(true);
    expect(q1.source).toMatch(/demo/);
    expect(q1.currency).toBe("KRW");
  });

  it("different symbols → different prices", async () => {
    const samsung = await kisAdapter.getQuote("005930");
    const naver = await kisAdapter.getQuote("035420");
    expect(samsung.price).not.toBe(naver.price);
  });

  it("getCandles returns 50 ascending integer candles", async () => {
    const a = await kisAdapter.getCandles("005930", {timeframe: "1d", limit: 50});
    expect(a.candles.length).toBe(50);
    for (let i = 1; i < a.candles.length; i++) {
      expect(a.candles[i].t).toBeGreaterThan(a.candles[i - 1].t);
      const c = a.candles[i];
      // 한국 주식 호가 단위 quantize → 모두 정수
      expect(Number.isInteger(c.o)).toBe(true);
      expect(Number.isInteger(c.c)).toBe(true);
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c));
    }
  });

  it("rankings volume sorts desc by volume24h", async () => {
    const r = await kisAdapter.rankings!("volume", {limit: 5});
    expect(r.length).toBe(5);
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].volume24h!).toBeGreaterThanOrEqual(r[i].volume24h!);
    }
  });

  it("unknown 6-digit code throws", async () => {
    await expect(kisAdapter.getQuote("999999")).rejects.toThrow();
  });
});
