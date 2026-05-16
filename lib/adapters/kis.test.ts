import {describe, expect, it} from "vitest";
import {kisAdapter, normalizeKisCandle, normalizeKisQuote} from "./kis";

describe("kisAdapter — demo mode (no API key)", () => {
  it("listAssets returns 24 KR tickers (registry 확장 후)", async () => {
    const assets = await kisAdapter.listAssets();
    expect(assets.length).toBe(24);
    expect(assets[0].class).toBe("kr");
    expect(assets[0].currency).toBe("KRW");
    expect(assets.find((a) => a.symbol === "005930")?.nameKo).toBe("삼성전자");
    expect(assets.find((a) => a.symbol === "105560")?.nameKo).toBe("KB금융");
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

describe("normalizeKisQuote (라이브 응답)", () => {
  it("parses KIS inquire-price output to Quote", () => {
    const q = normalizeKisQuote(
      {
        stck_prpr: "70000",
        prdy_vrss: "200",
        prdy_ctrt: "0.29",
        acml_vol: "12345678",
        acml_tr_pbmn: "864197460000",
        stck_hgpr: "70500",
        stck_lwpr: "69500",
      },
      "005930"
    );
    expect(q.symbol).toBe("005930");
    expect(q.class).toBe("kr");
    expect(q.currency).toBe("KRW");
    expect(q.price).toBe(70000);
    expect(q.changePct24h).toBe(0.29);
    expect(q.changeAbs24h).toBe(200);
    expect(q.high24h).toBe(70500);
    expect(q.low24h).toBe(69500);
    expect(q.source).toBe("kis");
  });
});

describe("normalizeKisCandle (라이브 응답)", () => {
  it("parses YYYYMMDD date → unix sec UTC + OHLCV integer", () => {
    const c = normalizeKisCandle({
      stck_bsop_date: "20260515",
      stck_oprc: "69000",
      stck_hgpr: "70500",
      stck_lwpr: "68500",
      stck_clpr: "70000",
      acml_vol: "12345678",
    });
    expect(c.t).toBe(Math.floor(Date.parse("2026-05-15T00:00:00Z") / 1000));
    expect(c.o).toBe(69000);
    expect(c.h).toBe(70500);
    expect(c.l).toBe(68500);
    expect(c.c).toBe(70000);
    expect(c.v).toBe(12345678);
  });
});
