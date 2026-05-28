import {NextResponse} from "next/server";
import type {AssetClass} from "@/lib/types";
import {buildOgSvg, getOgMeta, loadRecentCandles} from "@/lib/og/svg";

// 종목 상세 OG image (SVG 응답, ADR-0015 D).
// PNG 응답은 [symbol]/png/route.ts.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: {params: Promise<{asset: string; symbol: string}>}
) {
  const {asset, symbol} = await ctx.params;
  if (!["crypto", "us", "kr"].includes(asset)) {
    return new Response("invalid asset", {status: 400});
  }
  const meta = getOgMeta(asset as AssetClass, symbol);
  if (!meta) return new Response("unknown symbol", {status: 404});

  const candles = await loadRecentCandles(symbol);
  const svg = buildOgSvg(meta, candles);

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // CDN edge 1d / 브라우저 5min — 일봉 컨텍스트라 OG 이미지 24h stale OK.
      // 80 종목 × 1920 generations/day → 80 generations/day (95% ↓).
      "cache-control": "public, max-age=300, s-maxage=86400",
    },
  });
}
