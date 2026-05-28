import {getKvJson, setKvJson} from "@/lib/cache/kv-json";

// SVG → PNG 변환 (resvg-wasm). Workers 환경.
// - wasm: Next.js 빌드가 .wasm static import 를 거부 (module-not-found) → runtime fetch (CDN) + KV cache.
// - 폰트: Pretendard (한글+Latin) otf 도 runtime fetch + KV cache (base64). resvg fontBuffers.
//
// 한글 글리프 위해 Pretendard 필수 (resvg 는 시스템 폰트 접근 X — 명시 buffer 만).

const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const WASM_KV_KEY = "og-wasm:resvg-2.6.2";
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf";
const FONT_KV_KEY = "og-font:pretendard-regular-v1";

let wasmReady = false;
let wasmBytesCache: Uint8Array | null = null;
let fontCache: Uint8Array | null = null;

async function fetchWithCache(
  url: string,
  kvKey: string
): Promise<Uint8Array | null> {
  const cached = await getKvJson<string>(kvKey);
  if (cached) return base64ToBytes(cached);
  try {
    const res = await fetch(url, {
      cf: {cacheTtl: 86400, cacheEverything: true},
    } as RequestInit);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    setKvJson(kvKey, bytesToBase64(bytes), {ttlSeconds: 90 * 24 * 3600}).catch(
      () => {}
    );
    return bytes;
  } catch {
    return null;
  }
}

async function ensureWasm(): Promise<boolean> {
  if (wasmReady) return true;
  const {initWasm} = await import("@resvg/resvg-wasm");
  let bytes = wasmBytesCache;
  if (!bytes) {
    bytes = await fetchWithCache(WASM_URL, WASM_KV_KEY);
    if (!bytes) return false;
    wasmBytesCache = bytes;
  }
  try {
    await initWasm(bytes);
    wasmReady = true;
    return true;
  } catch {
    // 이미 init 된 경우 (isolate 재사용 race) — ready 간주
    wasmReady = true;
    return true;
  }
}

async function loadFont(): Promise<Uint8Array | null> {
  if (fontCache) return fontCache;
  const bytes = await fetchWithCache(FONT_URL, FONT_KV_KEY);
  if (bytes) fontCache = bytes;
  return bytes;
}

/**
 * SVG 문자열 → PNG bytes. wasm/폰트 로드 실패 시 null (caller 가 SVG fallback).
 */
export async function svgToPng(svg: string): Promise<Uint8Array | null> {
  try {
    const ok = await ensureWasm();
    if (!ok) return null;
    const font = await loadFont();
    if (!font) return null;

    const {Resvg} = await import("@resvg/resvg-wasm");
    const resvg = new Resvg(svg, {
      font: {
        fontBuffers: [font],
        defaultFontFamily: "Pretendard",
        loadSystemFonts: false,
      },
    });
    const rendered = resvg.render();
    const png = rendered.asPng();
    rendered.free();
    return png;
  } catch {
    return null;
  }
}

// ── base64 helpers (Workers Buffer 미보장 — 직접 구현) ──

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
