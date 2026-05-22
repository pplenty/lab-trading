// 외부 어댑터 공용 fetch — AbortController 로 timeout 강제.
// 5 adapter (Upbit/Binance/Twelve/KIS/CoinGecko) 의 fetch 호출 모두 경유.
//
// 동기:
// - KIS API 간헐 hang (5-13s) → Workers CPU/wall time 누적 → 1102 trigger
// - 모든 외부 호출의 worst-case latency 를 명확히 제한해야 loadQuote 의 D1 fallback
//   분기가 의미 있음 (외부 hang 동안엔 fallback 발동 안 함)
//
// 기본 5s — 시세 1회 호출에 충분 + cold start CPU 한도 안전.
// 사용처에서 더 짧게 (3s) 또는 더 길게 (백필 batch) 명시 가능.

const DEFAULT_TIMEOUT_MS = 5000;

export type FetchOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchWithTimeout(
  input: string | URL,
  opts: FetchOptions = {}
): Promise<Response> {
  const {timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest} = opts;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  // 사용자 signal 도 honor — 어느 쪽이든 abort 시 fetch abort.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), {once: true});
  }
  try {
    const res = await fetch(input, {...rest, signal: controller.signal});
    return res;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(
        `fetch timeout ${timeoutMs}ms — ${String(input).slice(0, 120)}`
      );
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}
