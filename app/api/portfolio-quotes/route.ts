import type {NextRequest} from "next/server";
import {loadQuote} from "@/lib/data/quotes";
import type {AssetClass, Quote} from "@/lib/types";

// 포트폴리오 페이지 client 가 보유 종목들의 current price 를 batch fetch.
// GET /api/portfolio-quotes?symbols=us:aapl,kr:005930,crypto:btc
// 응답: {quotes: {[key]: Quote | null}}
// KV 캐시 (loadQuote 내부) 활용 — 60s freshness 이내면 외부 API 호출 X.

export const dynamic = "force-dynamic";

const MAX_SYMBOLS = 30; // safety cap

function isAssetClass(v: string): v is AssetClass {
  return v === "crypto" || v === "us" || v === "kr";
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const tokens = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_SYMBOLS);

  const tasks = tokens.map(async (tk) => {
    const [cls, ...rest] = tk.split(":");
    const symbol = rest.join(":");
    if (!isAssetClass(cls) || !symbol) return [tk, null] as const;
    try {
      const q = await loadQuote(cls, symbol);
      return [tk, q] as const;
    } catch {
      return [tk, null] as const;
    }
  });

  const results = await Promise.all(tasks);
  const quotes: Record<string, Quote | null> = {};
  for (const [k, v] of results) quotes[k] = v;
  return Response.json({quotes});
}
