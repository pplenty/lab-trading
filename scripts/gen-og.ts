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
import {buildStaticOgSvg, getOgMeta} from "@/lib/og/card";
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
  const resvg = new Resvg(svg, {
    fitTo: {mode: "width", value: 1200},
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Pretendard",
    },
  });
  const png = resvg.render().asPng();
  const dir = join(OUT_DIR, asset);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, `${symbol}.png`), png);
  ok++;
}

console.log(
  `✓ OG PNG ${ok} 생성 (skip ${skipped}) → public/og/{crypto,us,kr}/*.png`
);
