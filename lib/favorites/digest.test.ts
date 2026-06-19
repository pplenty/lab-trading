import {describe, expect, it} from "vitest";
import {buildFavoriteDigest, type DigestItem} from "./digest";

const it_ = (id: string, changePct: number | null): DigestItem => ({
  id,
  symbol: id.split(":")[1],
  changePct,
});

describe("buildFavoriteDigest", () => {
  it("상승/하락/보합 카운트 + 평균(quote 있는 종목만)", () => {
    const d = buildFavoriteDigest([
      it_("crypto:btc", 5),
      it_("us:aapl", -2),
      it_("kr:005930", 0),
      it_("crypto:eth", 3),
    ]);
    expect(d.count).toBe(4);
    expect(d.quoted).toBe(4);
    expect(d.stale).toBe(0);
    expect(d.upCount).toBe(2);
    expect(d.downCount).toBe(1);
    expect(d.flatCount).toBe(1);
    expect(d.avgChangePct).toBeCloseTo((5 - 2 + 0 + 3) / 4, 9);
  });

  it("topGainer / topLoser", () => {
    const d = buildFavoriteDigest([
      it_("us:aapl", 5),
      it_("us:mu", -10),
      it_("crypto:sol", 12),
    ]);
    expect(d.topGainer).toEqual({id: "crypto:sol", symbol: "sol", changePct: 12});
    expect(d.topLoser).toEqual({id: "us:mu", symbol: "mu", changePct: -10});
  });

  it("quote 미로드(null)는 stale 로 분리 — 평균/카운트에서 제외", () => {
    const d = buildFavoriteDigest([
      it_("us:aapl", 4),
      it_("us:intc", null), // 데이터 대기
      it_("us:mu", null),
    ]);
    expect(d.count).toBe(3);
    expect(d.quoted).toBe(1);
    expect(d.stale).toBe(2);
    expect(d.upCount).toBe(1);
    expect(d.avgChangePct).toBe(4); // null 2개는 평균에서 제외
  });

  it("전부 stale → avgChangePct null, topMover null", () => {
    const d = buildFavoriteDigest([it_("us:a", null), it_("us:b", null)]);
    expect(d.quoted).toBe(0);
    expect(d.avgChangePct).toBeNull();
    expect(d.topGainer).toBeNull();
    expect(d.topLoser).toBeNull();
  });

  it("빈 집합", () => {
    const d = buildFavoriteDigest([]);
    expect(d.count).toBe(0);
    expect(d.avgChangePct).toBeNull();
    expect(d.upCount).toBe(0);
  });

  it("전부 하락이면 topGainer 는 가장 덜 떨어진 종목", () => {
    const d = buildFavoriteDigest([
      it_("us:a", -3),
      it_("us:b", -1),
      it_("us:c", -7),
    ]);
    expect(d.topGainer?.symbol).toBe("b");
    expect(d.topLoser?.symbol).toBe("c");
  });
});
