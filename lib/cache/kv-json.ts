import type {KVNamespace} from "@cloudflare/workers-types";

// 범용 KV JSON cache helper. quote-kv.ts 의 패턴을 일반화.
// 동일 binding (lab_trading_cache) — namespace prefix 로 분리.
//
// 사용: `await getKvJson<MyType>("bt-preview:us:aapl:1716422400")` 등.

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

export async function getKvJson<T>(key: string): Promise<T | null> {
  const kv = await getKV();
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setKvJson<T>(
  key: string,
  value: T,
  opts: {ttlSeconds: number}
): Promise<void> {
  const kv = await getKV();
  if (!kv) return;
  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: opts.ttlSeconds,
    });
  } catch {
    // silent — cache 실패가 응답에 영향 X
  }
}
