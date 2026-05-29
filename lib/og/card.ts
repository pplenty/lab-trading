import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import type {AssetClass, Candle} from "@/lib/types";

// 종목 상세 OG image 의 SVG 1200×630 빌더 + 메타.
// **D1 비의존** — node 빌드 스크립트(scripts/gen-og.ts)와 Workers 런타임 양쪽에서 import 가능.
// D1 봉 로드(loadRecentCandles)는 lib/og/svg.ts 에 격리.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export type SymbolMeta = {
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

export function formatPrice(v: number, currency: string): string {
  if (currency === "KRW") return `${Math.round(v).toLocaleString("ko-KR")} KRW`;
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
}

function svgEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// resvg-js 가 scripts/fonts/Pretendard-*.ttf 를 "Pretendard" 패밀리로 로드.
// 동적 SVG endpoint 는 브라우저/렌더러 fallback 에 의존하므로 동일 stack 유지해도 무해.
const FONT_FAMILY = "Pretendard, sans-serif";

const UP = "#ef4444"; // 한국식 상승 = 빨강 (브랜드 OG 기본)
const DOWN = "#3b82f6"; // 한국식 하락 = 파랑
const NEUTRAL = "#94a3b8";
const FG = "#0f172a";
const FG_MUTED = "#64748b";
const BG = "#fafafa";
const ACCENT = "#5b21b6";

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

/** 종목 상세 OG SVG (1200×630) — 가격 + 스파크라인 포함. 동적 endpoint 용 (D1 봉 필요). */
export function buildOgSvg(meta: SymbolMeta, candles: Candle[]): string {
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const price = last?.c ?? null;
  const changePct =
    last && prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : 0;

  const spark = buildSparklinePath(candles, 660, 220, 480, 200);
  const lineColor = spark.up ? UP : DOWN;
  const changeColor = changePct > 0 ? UP : changePct < 0 ? DOWN : NEUTRAL;
  const changeText = `${changePct > 0 ? "▲ " : changePct < 0 ? "▼ " : ""}${changePct.toFixed(2)}%`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}"/>
  <rect x="0" y="0" width="8" height="${OG_HEIGHT}" fill="${ACCENT}"/>

  <text x="60" y="160" font-family="${FONT_FAMILY}" font-size="64" font-weight="700" fill="${FG}">
    ${svgEscape(meta.nameKo)}
  </text>
  <text x="60" y="220" font-family="${FONT_FAMILY}" font-size="32" font-weight="500" fill="${FG_MUTED}">
    ${svgEscape(meta.ticker)} · ${svgEscape(meta.marketLabel)}
  </text>

  ${
    price !== null
      ? `<text x="60" y="360" font-family="${FONT_FAMILY}" font-size="84" font-weight="700" fill="${FG}">${svgEscape(formatPrice(price, meta.currency))}</text>
  <text x="60" y="420" font-family="${FONT_FAMILY}" font-size="36" font-weight="600" fill="${changeColor}">${svgEscape(changeText)}</text>`
      : `<text x="60" y="360" font-family="${FONT_FAMILY}" font-size="48" fill="${FG_MUTED}">데이터 준비 중</text>`
  }

  ${
    spark.path
      ? `<path d="${spark.path}" stroke="${lineColor}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${1140}" cy="${spark.lastY}" r="6" fill="${lineColor}"/>`
      : ""
  }

  <text x="660" y="450" font-family="${FONT_FAMILY}" font-size="20" fill="${FG_MUTED}">
    최근 ${candles.length}일 종가 추이
  </text>

  <line x1="60" y1="540" x2="${OG_WIDTH - 60}" y2="540" stroke="#e2e8f0" stroke-width="1"/>
  <text x="60" y="585" font-family="${FONT_FAMILY}" font-size="22" font-weight="600" fill="${ACCENT}">
    trading.jdgrid.com
  </text>
  <text x="${OG_WIDTH - 60}" y="585" font-family="${FONT_FAMILY}" font-size="20" fill="${FG_MUTED}" text-anchor="end">
    코인 · 해외주식 · 국내주식 + 일봉 백테스트
  </text>
</svg>`;
}

// ── 정적 OG 카드 (가격 비포함) ──────────────────────────────────────────────
// 빌드타임 PNG 생성용 (scripts/gen-og.ts). D1 봉 없이 종목명·티커·시장 + 장식 캔들.
// 시세는 24h 단위로 stale 하므로 정적 OG 에서 의도적으로 제외 (검색·공유 OG 는 종목 식별이 1급).

/** 심볼 문자열 → 결정적 시드 LCG (장식 캔들이 종목마다 일관되게 다르도록). */
function seededRand(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  if (s === 0) s = 1;
  return () => {
    // numerical recipes LCG
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** 가격 데이터가 아닌 순수 장식용 캔들스틱 모티프 (random-walk, 종목별 결정적). */
function buildDecorCandles(
  seed: string,
  x: number,
  y: number,
  w: number,
  h: number,
  count = 16
): string {
  const rand = seededRand(seed);
  const slot = w / count;
  const bodyW = Math.max(8, slot * 0.55);
  // random-walk 종가 생성
  const closes: number[] = [];
  let v = 0.5;
  for (let i = 0; i < count; i++) {
    v += (rand() - 0.5) * 0.22;
    v = Math.max(0.08, Math.min(0.92, v));
    closes.push(v);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const c of closes) {
    if (c < min) min = c;
    if (c > max) max = c;
  }
  const range = max - min || 1;
  const toY = (val: number) => y + h - ((val - min) / range) * h;

  const parts: string[] = [];
  let prevClose = closes[0];
  for (let i = 0; i < count; i++) {
    const close = closes[i];
    const open = i === 0 ? close - (rand() - 0.5) * 0.05 : prevClose;
    const up = close >= open;
    const color = up ? UP : DOWN;
    const cx = x + slot * i + slot / 2;
    const oY = toY(open);
    const cY = toY(close);
    const top = Math.min(oY, cY);
    const bot = Math.max(oY, cY);
    const wickTop = top - (rand() * 0.06 + 0.01) * h;
    const wickBot = bot + (rand() * 0.06 + 0.01) * h;
    parts.push(
      `<line x1="${cx.toFixed(1)}" y1="${wickTop.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${wickBot.toFixed(1)}" stroke="${color}" stroke-width="2" opacity="0.45"/>`
    );
    parts.push(
      `<rect x="${(cx - bodyW / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bodyW.toFixed(1)}" height="${Math.max(3, bot - top).toFixed(1)}" rx="2" fill="${color}" opacity="0.5"/>`
    );
    prevClose = close;
  }
  return parts.join("\n  ");
}

/**
 * 정적 OG 카드 SVG (1200×630, 가격 비포함).
 * @param assetLabel "코인" | "해외주식" | "국내주식" 등 상단 kicker.
 */
export function buildStaticOgSvg(
  meta: SymbolMeta,
  opts: {assetLabel?: string} = {}
): string {
  const kicker = opts.assetLabel ?? meta.marketLabel;
  const decor = buildDecorCandles(meta.ticker + meta.nameEn, 690, 150, 450, 300);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${BG}"/>
  <rect x="0" y="0" width="8" height="${OG_HEIGHT}" fill="${ACCENT}"/>

  ${decor}

  <text x="60" y="130" font-family="${FONT_FAMILY}" font-size="26" font-weight="600" fill="${ACCENT}" letter-spacing="2">
    ${svgEscape(kicker)}
  </text>
  <text x="60" y="240" font-family="${FONT_FAMILY}" font-size="80" font-weight="700" fill="${FG}">
    ${svgEscape(meta.nameKo)}
  </text>
  <text x="60" y="296" font-family="${FONT_FAMILY}" font-size="34" font-weight="500" fill="${FG_MUTED}">
    ${svgEscape(meta.nameEn)}
  </text>

  <rect x="60" y="340" width="${Math.max(120, meta.ticker.length * 26 + 48)}" height="60" rx="12" fill="#ffffff" stroke="${ACCENT}" stroke-width="2"/>
  <text x="${60 + Math.max(120, meta.ticker.length * 26 + 48) / 2}" y="380" font-family="${FONT_FAMILY}" font-size="32" font-weight="700" fill="${ACCENT}" text-anchor="middle">
    ${svgEscape(meta.ticker)}
  </text>
  <text x="${60 + Math.max(120, meta.ticker.length * 26 + 48) + 24}" y="380" font-family="${FONT_FAMILY}" font-size="28" font-weight="500" fill="${FG_MUTED}">
    ${svgEscape(meta.marketLabel)}
  </text>

  <text x="60" y="470" font-family="${FONT_FAMILY}" font-size="26" font-weight="500" fill="${FG}">
    일봉 차트 · 26 지표 · 백테스트 6 전략
  </text>

  <line x1="60" y1="540" x2="${OG_WIDTH - 60}" y2="540" stroke="#e2e8f0" stroke-width="1"/>
  <text x="60" y="585" font-family="${FONT_FAMILY}" font-size="22" font-weight="600" fill="${ACCENT}">
    trading.jdgrid.com
  </text>
  <text x="${OG_WIDTH - 60}" y="585" font-family="${FONT_FAMILY}" font-size="20" fill="${FG_MUTED}" text-anchor="end">
    코인 · 해외주식 · 국내주식 + 일봉 백테스트
  </text>
</svg>`;
}
