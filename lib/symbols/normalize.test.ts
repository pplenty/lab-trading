import {describe, expect, it} from "vitest";
import {toSymbol} from "./normalize";

describe("toSymbol", () => {
  it("crypto/us — lowercase, strip non-alnum", () => {
    expect(toSymbol("BTC", "crypto")).toBe("btc");
    expect(toSymbol("  AAPL ", "us")).toBe("aapl");
    expect(toSymbol("eth", "crypto")).toBe("eth");
    expect(toSymbol("brk.a", "us")).toBe("brka");
  });

  it("kr — 6 자리 코드 0 padding", () => {
    expect(toSymbol("005930", "kr")).toBe("005930");
    expect(toSymbol("5930", "kr")).toBe("005930");
    expect(toSymbol("035720", "kr")).toBe("035720");
  });

  it("throws on empty / invalid input", () => {
    expect(() => toSymbol("", "crypto")).toThrow();
    expect(() => toSymbol("", "kr")).toThrow();
    expect(() => toSymbol("abc", "kr")).toThrow();
  });
});
