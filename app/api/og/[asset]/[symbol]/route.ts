import {NextResponse} from "next/server";
import type {AssetClass} from "@/lib/types";
import {buildOgSvg, getOgMeta, loadRecentCandles} from "@/lib/og/svg";

// 종목 상세 OG image (동적 SVG 응답, 가격+스파크라인 포함, ADR-0015 D).
// 카카오톡/트위터가 렌더하는 기본 og:image 는 빌드타임 정적 PNG(public/og/<asset>/<symbol>.png,
// scripts/gen-og.ts). 이 endpoint 는 가격 포함 동적 버전 fallback 으로 유지.

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
