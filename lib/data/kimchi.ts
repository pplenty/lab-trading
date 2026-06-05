import {upbitAdapter} from "@/lib/adapters/upbit";
import {binanceAdapter} from "@/lib/adapters/binance";
import {loadUsdKrw, type FxRate} from "@/lib/data/fx";
import {getKvJson, setKvJson} from "@/lib/cache/kv-json";
import type {Quote} from "@/lib/types";

// 김치 프리미엄 — Upbit KRW 가격이 Binance USD 가격(×USD/KRW 환율) 대비 얼마나 비싼지(%).
// 한국 거래소 프리미엄/역프리미엄 지표. 양수 = 한국이 비쌈(김프), 음수 = 역프.
//   premium% = (upbitKRW / (binanceUSD × USDKRW) − 1) × 100
// Upbit·Binance listQuotes 를 동시 호출(타이밍 정합) + Frankfurter 환율. KV 90s fresh.
// 주의: 환율은 일 단위 기준이라 실시간 김프 사이트와 소수% 차이 가능 — 환율 기준일 라벨로 명시.

export type KimchiRow = {
  symbol: string;
  upbitKrw: number;
  binanceUsd: number;
  impliedKrw: number; // binanceUsd × fx
  premiumPct: number;
};

export type KimchiSnapshot = {
  rows: KimchiRow[]; // premium 내림차순
  avgPremium: number;
  btc: KimchiRow | null;
  fx: FxRate;
  updatedAt: number; // unix ms
};

/** (upbitKRW / (binanceUSD × fx) − 1) × 100. 테스트용 순수 함수. */
export function computeKimchiPremium(
  upbitKrw: number,
  binanceUsd: number,
  fxRate: number
): number {
  const implied = binanceUsd * fxRate;
  if (implied <= 0) return 0;
  return (upbitKrw / implied - 1) * 100;
}

const FRESH_MS = 90 * 1000; // 90s
const CACHE_TTL_SEC = 60 * 60; // 1h KV 보관(stale 폴백)

/** Upbit·Binance 공통 상장 코인의 김치 프리미엄. 실패/데이터 부족 + 캐시 없음 → null. */
export async function loadKimchiPremium(): Promise<KimchiSnapshot | null> {
  const key = "kimchi:all";
  const cached = await getKvJson<KimchiSnapshot>(key);
  const now = Date.now();
  if (cached && now - cached.updatedAt < FRESH_MS) return cached;

  try {
    const [upbit, binance, fx] = await Promise.all([
      upbitAdapter.listQuotes().catch(() => [] as Quote[]),
      binanceAdapter.listQuotes().catch(() => [] as Quote[]),
      loadUsdKrw(),
    ]);
    if (!fx || upbit.length === 0 || binance.length === 0) {
      return cached ?? null; // 한 소스라도 비면 stale 유지
    }

    const binMap = new Map(binance.map((q) => [q.symbol, q.price]));
    const rows: KimchiRow[] = [];
    for (const u of upbit) {
      const bUsd = binMap.get(u.symbol);
      if (bUsd === undefined || bUsd <= 0 || u.price <= 0) continue;
      const premiumPct = computeKimchiPremium(u.price, bUsd, fx.rate);
      // |프리미엄| > 30% 는 양 거래소 가격 불일치(상장폐지·리네임 토큰, 예: MATIC→POL) 신호 → 제외.
      // 실제 김프는 통상 ±10% 이내라 30% 초과는 데이터 오류로 간주(평균 왜곡 방지).
      if (Math.abs(premiumPct) > 30) continue;
      rows.push({
        symbol: u.symbol,
        upbitKrw: u.price,
        binanceUsd: bUsd,
        impliedKrw: bUsd * fx.rate,
        premiumPct,
      });
    }
    if (rows.length === 0) return cached ?? null;

    rows.sort((a, b) => b.premiumPct - a.premiumPct);
    const avgPremium =
      rows.reduce((s, r) => s + r.premiumPct, 0) / rows.length;
    const btc = rows.find((r) => r.symbol === "btc") ?? null;

    const snap: KimchiSnapshot = {rows, avgPremium, btc, fx, updatedAt: now};
    await setKvJson(key, snap, {ttlSeconds: CACHE_TTL_SEC});
    return snap;
  } catch {
    return cached ?? null;
  }
}
