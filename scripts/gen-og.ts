/**
 * 빌드타임 정적 OG PNG 생성기.
 *
 * 왜 빌드타임 정적인가:
 *  - Next 16 turbopack 은 .wasm static import 거부 + Cloudflare Workers 는 런타임
 *    WebAssembly.instantiate 금지 → resvg-wasm 런타임 PNG 변환 이중 차단 (롤백됨).
 *  - @resvg/resvg-js 는 node-native (turbopack/Workers 무관) → 빌드타임에만 실행.
 *  - 시세는 24h 단위로 stale → 정적 OG 는 가격 제외, 종목 식별(이름·티커·시장)에 집중.
 *
 * 산출물: public/og/<asset>/<symbol>.png  (80 종목)
 * 실행:   bun run gen:og   (registry 변경 시에만 재생성)
 */
import {Resvg} from "@resvg/resvg-js";
import {existsSync, mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {buildPageOgSvg, buildStaticOgSvg, getOgMeta} from "@/lib/og/card";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import type {AssetClass} from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FONT_DIR = join(__dirname, "fonts");
const OUT_DIR = join(ROOT, "public", "og");

const FONT_FILES = [
  join(FONT_DIR, "Pretendard-Bold.ttf"),
  join(FONT_DIR, "Pretendard-Regular.ttf"),
];

for (const f of FONT_FILES) {
  if (!existsSync(f)) {
    console.error(
      `✗ 폰트 누락: ${f}\n  Pretendard TTF 를 scripts/fonts/ 에 두세요 ` +
        `(release zip 의 public/static/alternative/Pretendard-{Bold,Regular}.ttf).`
    );
    process.exit(1);
  }
}

const ASSET_LABEL: Record<AssetClass, string> = {
  crypto: "코인",
  us: "해외주식",
  kr: "국내주식",
};

type Job = {asset: AssetClass; symbol: string};

const jobs: Job[] = [
  ...cryptoRegistry.map((e) => ({asset: "crypto" as const, symbol: e.symbol})),
  ...usRegistry.map((e) => ({asset: "us" as const, symbol: e.symbol})),
  ...krRegistry.map((e) => ({asset: "kr" as const, symbol: e.symbol})),
];

function renderPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: {mode: "width", value: 1200},
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Pretendard",
    },
  });
  return resvg.render().asPng();
}

// 랜딩 페이지 카드 (홈 · 자산군 인덱스 · 백테스트) — 가장 많이 공유되는 URL.
const PAGE_CARDS = [
  {
    name: "home",
    kicker: "TRADING LAB",
    title: "코인 · 해외주식 · 국내주식",
    subtitle: "한 화면에서 시세부터 일봉 백테스트까지",
    tagline: "80 종목 · 26 지표 · 백테스트 6 전략 · 통합 검색",
  },
  {
    name: "crypto",
    kicker: "코인",
    title: "코인 시세 · 차트",
    subtitle: "비트코인 · 이더리움 등 27 종목 · Upbit KRW",
    tagline: "일봉 차트 · 26 지표 · 백테스트",
  },
  {
    name: "us",
    kicker: "해외주식",
    title: "미국주식 시세 · 차트",
    subtitle: "애플 · 엔비디아 등 30 종목 · NASDAQ · NYSE",
    tagline: "일봉 차트 · 26 지표 · 백테스트",
  },
  {
    name: "kr",
    kicker: "국내주식",
    title: "국내주식 시세 · 차트",
    subtitle: "삼성전자 · SK하이닉스 등 24 종목 · KOSPI · KOSDAQ",
    tagline: "일봉 차트 · 26 지표 · 백테스트",
  },
  {
    name: "backtest",
    kicker: "백테스트 랩",
    title: "일봉 백테스트",
    subtitle: "전략을 일봉으로 검증 — 수익률 · MDD · Sharpe",
    tagline: "6 프리셋 + 커스텀 AND/OR 조건",
  },
  {
    name: "news",
    kicker: "뉴스",
    title: "통합 뉴스",
    subtitle: "코인 · 해외주식 · 국내주식 최신 헤드라인",
    tagline: "6 매체 RSS · 종목별 관련 뉴스 · 검색",
  },
];

mkdirSync(OUT_DIR, {recursive: true});
let pageOk = 0;
for (const card of PAGE_CARDS) {
  const svg = buildPageOgSvg({...card, seed: `page:${card.name}`});
  writeFileSync(join(OUT_DIR, `${card.name}.png`), renderPng(svg));
  pageOk++;
}

let ok = 0;
let skipped = 0;

for (const {asset, symbol} of jobs) {
  const meta = getOgMeta(asset, symbol);
  if (!meta) {
    console.warn(`  - skip ${asset}/${symbol} (no meta)`);
    skipped++;
    continue;
  }
  const svg = buildStaticOgSvg(meta, {assetLabel: ASSET_LABEL[asset]});
  const dir = join(OUT_DIR, asset);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, `${symbol}.png`), renderPng(svg));
  ok++;
}

console.log(
  `✓ OG PNG: 페이지 ${pageOk} + 종목 ${ok} (skip ${skipped}) → public/og/`
);
