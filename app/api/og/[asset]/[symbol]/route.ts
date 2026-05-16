import {NextResponse} from "next/server";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import type {AssetClass, Candle} from "@/lib/types";

// 종목 상세 OpenGraph 이미지 (ADR-0015 D, Phase 2).
//
// 1200×630 SVG 응답 — Workers 호환 (외부 dep 0, system font).
// 한국어 / 영문 / 숫자 모두 SVG <text> 로 직접 렌더 — satori / @vercel/og 미사용.
// 그래픽: 좌측 종목 정보 + 우측 sparkline (D1 최근 60봉) + 하단 워터마크.
//
// URL: /api/og/<asset>/<symbol>  →  image/svg+xml
// 종목 상세 페이지 metadata.openGraph.images 에 이 URL 박힘.

export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;

type SymbolMeta = {
  nameKo: string;
  nameEn: string;
  ticker: string;
  currency: string;
  marketLabel: string;
};

function getMeta(asset: AssetClass, symbol: string): SymbolMeta | null {
  if (asset === "crypto") {
    const e = cryptoRegistry.find((x) => x.symbol === symbol);
    if (!e) return null;
    return {
      nameKo: e.nameKo ?? e.name,
      nameEn: e.name,
      ticker: e.symbol.toUpperCase(),
      currency: "KRW",
      marketLabel: "Crypto · Upbit KRW",
    };
  }
  if (asset === "us") {
    const e = usRegistry.find((x) => x.symbol === symbol);
    if (!e) return null;
    return {
      nameKo: e.nameKo ?? e.name,
      nameEn: e.name,
      ticker: e.ticker,
      currency: "USD",
      marketLabel: e.market,
    };
  }
  const e = krRegistry.find((x) => x.symbol === symbol);
  if (!e) return null;
  return {
    nameKo: e.nameKo,
    nameEn: e.name,
    ticker: e.ticker,
    currency: "KRW",
    marketLabel: e.market,
  };
}

async function loadRecent(symbol: string, limit: number = 60): Promise<Candle[]> {
  if (!(await isDbAvailable())) return [];
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const rows = await repo.range({
      symbol,
      from: now - limit * 86400 * 1.7, // 휴장 여유
      to: now + 86400,
    });
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

function formatPrice(v: number, currency: string): string {
  if (currency === "KRW") {
    return `₩${Math.round(v).toLocaleString("ko-KR")}`;
  }
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
}

function buildSparklinePath(
  candles: Candle[],
  x: number,
  y: number,
  w: number,
  h: number
): {path: string; lastY: number; up: boolean} {
  if (candles.length < 2) return {path: "", lastY: y + h / 2, up: true};
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.c < min) min = c.c;
    if (c.c > max) max = c.c;
  }
  const range = max - min || 1;
  const stepX = w / (candles.length - 1);
  const pts = candles.map((c, i) => {
    const px = x + i * stepX;
    const py = y + h - ((c.c - min) / range) * h;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });
  const up = candles[candles.length - 1].c >= candles[0].c;
  const lastY = Number(pts[pts.length - 1].split(",")[1]);
  return {path: `M ${pts.join(" L ")}`, lastY, up};
}

function svgEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _req: Request,
  ctx: {params: Promise<{asset: string; symbol: string}>}
) {
  const {asset, symbol} = await ctx.params;
  if (!["crypto", "us", "kr"].includes(asset)) {
    return new Response("invalid asset", {status: 400});
  }
  const meta = getMeta(asset as AssetClass, symbol);
  if (!meta) {
    return new Response("unknown symbol", {status: 404});
  }
  const candles = await loadRecent(symbol);
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const price = last?.c ?? null;
  const changePct =
    last && prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : 0;

  // 한국식 컬러 시맨틱 — 상승 빨강 / 하락 파랑 (ADR-0012)
  const upColor = "#ef4444";
  const downColor = "#3b82f6";
  const neutral = "#94a3b8";
  const fg = "#0f172a";
  const fgMuted = "#64748b";
  const bg = "#fafafa";
  const accent = "#5b21b6"; // white-iris 디폴트

  const spark = buildSparklinePath(candles, 660, 220, 480, 200);
  const lineColor = spark.up ? upColor : downColor;

  const changeColor =
    changePct > 0 ? upColor : changePct < 0 ? downColor : neutral;
  const changeText = `${changePct > 0 ? "▲ " : changePct < 0 ? "▼ " : ""}${changePct.toFixed(2)}%`;

  // 한국어 + 영문 system font stack — Workers 가 서빙하는 SVG 라 client browser font 사용.
  const fontStack =
    'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Segoe UI",Roboto,sans-serif';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
  <rect x="0" y="0" width="8" height="${HEIGHT}" fill="${accent}"/>

  <!-- 종목명 + ticker -->
  <text x="60" y="160" font-family="${fontStack}" font-size="64" font-weight="700" fill="${fg}">
    ${svgEscape(meta.nameKo)}
  </text>
  <text x="60" y="220" font-family="${fontStack}" font-size="32" font-weight="500" fill="${fgMuted}">
    ${svgEscape(meta.ticker)} · ${svgEscape(meta.marketLabel)}
  </text>

  <!-- 가격 + 변동률 -->
  ${
    price !== null
      ? `<text x="60" y="360" font-family="${fontStack}" font-size="84" font-weight="700" fill="${fg}">${svgEscape(formatPrice(price, meta.currency))}</text>
  <text x="60" y="420" font-family="${fontStack}" font-size="36" font-weight="600" fill="${changeColor}">${svgEscape(changeText)}</text>`
      : `<text x="60" y="360" font-family="${fontStack}" font-size="48" fill="${fgMuted}">데이터 준비 중</text>`
  }

  <!-- sparkline -->
  ${
    spark.path
      ? `<path d="${spark.path}" stroke="${lineColor}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${1140}" cy="${spark.lastY}" r="6" fill="${lineColor}"/>`
      : ""
  }

  <!-- 일봉 라벨 -->
  <text x="660" y="450" font-family="${fontStack}" font-size="20" fill="${fgMuted}">
    최근 ${candles.length}일 종가 추이
  </text>

  <!-- 푸터 -->
  <line x1="60" y1="540" x2="${WIDTH - 60}" y2="540" stroke="#e2e8f0" stroke-width="1"/>
  <text x="60" y="585" font-family="${fontStack}" font-size="22" font-weight="600" fill="${accent}">
    trading.jdgrid.com
  </text>
  <text x="${WIDTH - 60}" y="585" font-family="${fontStack}" font-size="20" fill="${fgMuted}" text-anchor="end">
    코인 · 해외주식 · 국내주식 + 일봉 백테스트
  </text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // CF Edge cache 1시간 — 가격 갱신 후 stale 짧게
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}
