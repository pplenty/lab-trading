import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import type {AssetClass, Candle} from "@/lib/types";

// 종목 상세 OG image 의 SVG 1200×630 생성 + 메타 + 봉 로드 헬퍼.
// SVG 응답 / PNG 변환 (resvg-wasm) 두 endpoint 공용.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

type SymbolMeta = {
  nameKo: string;
  nameEn: string;
  ticker: string;
  currency: string;
  marketLabel: string;
};

export function getOgMeta(asset: AssetClass, symbol: string): SymbolMeta | null {
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

export async function loadRecentCandles(
  symbol: string,
  limit: number = 60
): Promise<Candle[]> {
  if (!(await isDbAvailable())) return [];
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const rows = await repo.range({
      symbol,
      from: now - limit * 86400 * 1.7,
      to: now + 86400,
    });
    return rows.slice(-limit);
  } catch {
    return [];
  }
}

function formatPrice(v: number, currency: string): string {
  if (currency === "KRW") return `${Math.round(v).toLocaleString("ko-KR")} KRW`;
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

/** 종목 상세 OG SVG 문자열 (1200×630). PNG 변환은 lib/og/png.ts. */
export function buildOgSvg(
  meta: SymbolMeta,
  candles: Candle[]
): string {
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const price = last?.c ?? null;
  const changePct =
    last && prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : 0;

  const upColor = "#ef4444";
  const downColor = "#3b82f6";
  const neutral = "#94a3b8";
  const fg = "#0f172a";
  const fgMuted = "#64748b";
  const bg = "#fafafa";
  const accent = "#5b21b6";

  const spark = buildSparklinePath(candles, 660, 220, 480, 200);
  const lineColor = spark.up ? upColor : downColor;
  const changeColor =
    changePct > 0 ? upColor : changePct < 0 ? downColor : neutral;
  const changeText = `${changePct > 0 ? "▲ " : changePct < 0 ? "▼ " : ""}${changePct.toFixed(2)}%`;

  // resvg PNG 변환 시 Pretendard (한글+Latin) 매칭. 브라우저 SVG fallback 은 sans-serif.
  const fontStack = "Pretendard, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${bg}"/>
  <rect x="0" y="0" width="8" height="${OG_HEIGHT}" fill="${accent}"/>

  <text x="60" y="160" font-family="${fontStack}" font-size="64" font-weight="700" fill="${fg}">
    ${svgEscape(meta.nameKo)}
  </text>
  <text x="60" y="220" font-family="${fontStack}" font-size="32" font-weight="500" fill="${fgMuted}">
    ${svgEscape(meta.ticker)} · ${svgEscape(meta.marketLabel)}
  </text>

  ${
    price !== null
      ? `<text x="60" y="360" font-family="${fontStack}" font-size="84" font-weight="700" fill="${fg}">${svgEscape(formatPrice(price, meta.currency))}</text>
  <text x="60" y="420" font-family="${fontStack}" font-size="36" font-weight="600" fill="${changeColor}">${svgEscape(changeText)}</text>`
      : `<text x="60" y="360" font-family="${fontStack}" font-size="48" fill="${fgMuted}">데이터 준비 중</text>`
  }

  ${
    spark.path
      ? `<path d="${spark.path}" stroke="${lineColor}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${1140}" cy="${spark.lastY}" r="6" fill="${lineColor}"/>`
      : ""
  }

  <text x="660" y="450" font-family="${fontStack}" font-size="20" fill="${fgMuted}">
    최근 ${candles.length}일 종가 추이
  </text>

  <line x1="60" y1="540" x2="${OG_WIDTH - 60}" y2="540" stroke="#e2e8f0" stroke-width="1"/>
  <text x="60" y="585" font-family="${fontStack}" font-size="22" font-weight="600" fill="${accent}">
    trading.jdgrid.com
  </text>
  <text x="${OG_WIDTH - 60}" y="585" font-family="${fontStack}" font-size="20" fill="${fgMuted}" text-anchor="end">
    코인 · 해외주식 · 국내주식 + 일봉 백테스트
  </text>
</svg>`;
}
