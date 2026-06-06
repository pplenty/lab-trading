import {getKvJson} from "@/lib/cache/kv-json";
import type {FxRate} from "@/lib/data/fx";

// 김치 프리미엄 — Upbit KRW 가격이 글로벌 USD 가격(×USD/KRW 환율) 대비 얼마나 비싼지(%).
// 양수 = 한국이 비쌈(김프), 음수 = 역프.  premium% = (upbitKRW / (globalUSD × USDKRW) − 1) × 100
//
// **계산은 cron(node) 에서** (scripts/compute-kimchi.ts) — Upbit·CoinGecko·Binance 라이브 호출이
// CF Worker 데이터센터 IP 에서 불안정(검증됨)하기 때문. cron 이 binance.vision 글로벌가로 계산 →
// /api/cron/kimchi 가 KV 저장 → 페이지(Worker)는 loadKimchiFromKv 로 읽기만. (OG cron 과 동일 패턴.)

export const KIMCHI_KV_KEY = "kimchi:all";

export type KimchiRow = {
  symbol: string;
  upbitKrw: number;
  globalUsd: number;
  impliedKrw: number; // globalUsd × fx
  premiumPct: number;
};

export type KimchiSnapshot = {
  rows: KimchiRow[]; // premium 내림차순
  avgPremium: number;
  btc: KimchiRow | null;
  fx: FxRate;
  usdSource: string; // 글로벌 USD 출처
  updatedAt: number; // unix ms
};

/** (upbitKRW / (globalUSD × fx) − 1) × 100. 순수 함수. */
export function computeKimchiPremium(
  upbitKrw: number,
  globalUsd: number,
  fxRate: number
): number {
  const implied = globalUsd * fxRate;
  if (implied <= 0) return 0;
  return (upbitKrw / implied - 1) * 100;
}

/**
 * 스냅샷 빌더 (순수, fetch·KV 없음) — cron 과 테스트가 공유.
 * @param upbit  Upbit KRW quote ({symbol, price})
 * @param usdMap symbol → 글로벌 USD 가격
 * @param fx     USD/KRW 환율
 * |프리미엄|>30% 는 양 소스 가격 불일치(상장폐지·리네임 토큰, 예: MATIC→POL) 신호 → 제외(평균 왜곡 방지).
 */
export function buildKimchiSnapshot(
  upbit: Array<{symbol: string; price: number}>,
  usdMap: Map<string, number>,
  fx: FxRate,
  usdSource: string,
  nowMs: number
): KimchiSnapshot | null {
  const rows: KimchiRow[] = [];
  for (const u of upbit) {
    const usd = usdMap.get(u.symbol);
    if (usd === undefined || usd <= 0 || u.price <= 0) continue;
    const premiumPct = computeKimchiPremium(u.price, usd, fx.rate);
    if (Math.abs(premiumPct) > 30) continue;
    rows.push({
      symbol: u.symbol,
      upbitKrw: u.price,
      globalUsd: usd,
      impliedKrw: usd * fx.rate,
      premiumPct,
    });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.premiumPct - a.premiumPct);
  const avgPremium = rows.reduce((s, r) => s + r.premiumPct, 0) / rows.length;
  const btc = rows.find((r) => r.symbol === "btc") ?? null;
  return {rows, avgPremium, btc, fx, usdSource, updatedAt: nowMs};
}

/** 페이지(Worker)용 — KV 에 cron 이 저장한 스냅샷 읽기만. 없으면 null(패널 자동 숨김). */
export async function loadKimchiFromKv(): Promise<KimchiSnapshot | null> {
  return getKvJson<KimchiSnapshot>(KIMCHI_KV_KEY);
}
