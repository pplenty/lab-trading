import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import type {BacktestResult} from "@/lib/backtest/types";
import type {AssetClass, Candle} from "@/lib/types";

// 백테스트 결과 공유 — KV 저장 + 짧은 id 발급.
// 친구에게 /backtest/share/<id> URL 전달 → 동일 결과 노출.
// candles + result + meta 모두 fix — 추후 시세 변동과 무관.

export type SharedBacktest = {
  /** 메타 — 친구가 보는 화면의 헤더 */
  asset: AssetClass;
  symbol: string;
  displayName: string;
  displayTicker: string;
  currency: string;
  strategyId: string;
  params: Record<string, number>;
  tf: string; // "1d" | "1w" | "1mo"
  initialCapital: number;
  /** 결과 + 차트용 봉 */
  candles: Candle[];
  result: BacktestResult;
  /** 생성 시각 (UTC ISO). */
  createdAt: string;
  /** 공유한 사용자가 메모 (선택). */
  note?: string;
};

const KV_PREFIX = "bt-share:";
// 90일 TTL — 사용자가 본 공유 링크가 한참 후에도 살아있도록.
const TTL_SECONDS = 90 * 24 * 3600;

// 6자 base36 — 충돌 확률 약 1 / 2.2 billion (충분히 큼)
function newId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function saveShare(data: SharedBacktest): Promise<string> {
  // 충돌 회피 — 4 번까지 시도
  for (let i = 0; i < 4; i++) {
    const id = newId();
    const key = KV_PREFIX + id;
    const existing = await getKvJson<SharedBacktest>(key);
    if (existing) continue;
    await setKvJson(key, data, {ttlSeconds: TTL_SECONDS});
    return id;
  }
  // 모두 충돌 — 진입 매우 희박, 마지막 시도는 그대로 덮어쓰기
  const id = newId();
  await setKvJson(KV_PREFIX + id, data, {ttlSeconds: TTL_SECONDS});
  return id;
}

export async function loadShare(id: string): Promise<SharedBacktest | null> {
  if (!/^[a-z0-9]{4,12}$/.test(id)) return null;
  return getKvJson<SharedBacktest>(KV_PREFIX + id);
}
