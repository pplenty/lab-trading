import {NextResponse} from "next/server";
import type {AssetClass} from "@/lib/types";
import {buildOgSvg, getOgMeta, loadRecentCandles} from "@/lib/og/svg";
import {svgToPng} from "@/lib/og/png";

// 종목 상세 OG image — PNG 우선 (Twitter/카카오 SVG 미렌더 회피), 실패 시 SVG fallback.
// resvg-wasm + Pretendard otf (한글) — lib/og/png.ts.

export const dynamic = "force-dynamic";

// CDN edge 1d / 브라우저 5min — 일봉 컨텍스트라 OG 24h stale OK.
const CACHE = "public, max-age=300, s-maxage=86400";

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

  // PNG 변환 시도 — resvg-wasm. 실패 (wasm/폰트 로드 불가) 시 SVG fallback.
  const png = await svgToPng(svg);
  if (png) {
    return new Response(png as BodyInit, {
      headers: {"content-type": "image/png", "cache-control": CACHE},
    });
  }

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": CACHE,
    },
  });
}
