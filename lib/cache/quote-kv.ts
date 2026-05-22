import type {KVNamespace} from "@cloudflare/workers-types";
import type {Quote} from "@/lib/types";

// loadQuote KV cache layer — Upbit/Twelve Data/KIS 외부 API 호출 결과 캐시.
// 종목 상세 SSR 의 TTFB 외부 quote 부분을 200-500ms → ~5ms (KV hit) 로 단축.
//
// TTL 180s — KR cold start 시 KIS API hang (5-13s) 안전망. 일봉 컨텍스트라 3분 stale OK.
// 종목 상세 ISR revalidate 300s 와 일관 — KV 가 ISR 보다 약간 짧아 fresh 신호.

const TTL_SECONDS = 180;

function key(asset: string, symbol: string): string {
  return `quote:${asset}:${symbol}`;
}

async function getKV(): Promise<KVNamespace | null> {
  try {
    const {getCloudflareContext} = await import("@opennextjs/cloudflare");
    let env: unknown;
    try {
      env = getCloudflareContext().env;
    } catch {
      env = (await getCloudflareContext({async: true})).env;
    }
    const e = env as {lab_trading_cache?: KVNamespace};
    return e.lab_trading_cache ?? null;
  } catch {
    return null;
  }
}

export async function getQuoteCache(asset: string, symbol: string): Promise<Quote | null> {
  const kv = await getKV();
  if (!kv) return null;
  try {
    const raw = await kv.get(key(asset, symbol));
    if (!raw) return null;
    return JSON.parse(raw) as Quote;
  } catch {
    return null;
  }
}

export async function setQuoteCache(asset: string, symbol: string, q: Quote): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.put(key(asset, symbol), JSON.stringify(q), {
      expirationTtl: TTL_SECONDS,
    });
  } catch {
    // silent — cache 실패가 사용자 응답에 영향 X
  }
}
