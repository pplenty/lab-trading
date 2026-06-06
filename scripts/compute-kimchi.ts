/**
 * 김치 프리미엄 스냅샷 계산 → /api/cron/kimchi 로 POST (KV 저장).
 * GitHub Actions(node)에서 ~15분마다 실행. Upbit·Binance·환율 라이브 호출이 CF Worker
 * 데이터센터 IP 에서 불안정해 계산을 node 로 외부화 (lib/data/kimchi.ts 참조).
 *
 * 글로벌 USD: data-api.binance.vision (공개 데이터 CDN — api.binance.com 지오블록 회피).
 *   전체 가격을 받아 registry binancePair 로 필터 (node 라 CPU 한도·invalid-symbol 무관).
 *
 * env: SITE(기본 prod), BACKFILL_TOKEN(POST 인증).
 * 실행: bun run scripts/compute-kimchi.ts
 */
import {upbitAdapter} from "@/lib/adapters/upbit";
import {loadUsdKrw} from "@/lib/data/fx";
import {buildKimchiSnapshot} from "@/lib/data/kimchi";
import {cryptoRegistry} from "@/lib/symbols/registry";

const SITE = process.env.SITE ?? "https://trading.jdgrid.com";
const TOKEN = process.env.BACKFILL_TOKEN ?? "";

async function binanceVisionUsd(): Promise<Map<string, number>> {
  const res = await fetch(
    "https://data-api.binance.vision/api/v3/ticker/price",
    {headers: {Accept: "application/json"}}
  );
  if (!res.ok) throw new Error(`binance.vision HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{symbol: string; price: string}>;
  const pairToSym = new Map(
    cryptoRegistry
      .filter((e) => e.binancePair)
      .map((e) => [e.binancePair, e.symbol])
  );
  const map = new Map<string, number>();
  for (const r of arr) {
    const sym = pairToSym.get(r.symbol);
    const p = parseFloat(r.price);
    if (sym && Number.isFinite(p) && p > 0) map.set(sym, p);
  }
  return map;
}

const [upbit, usd, fx] = await Promise.all([
  upbitAdapter.listQuotes().catch((e) => {
    console.error("Upbit 실패:", String(e).slice(0, 120));
    return [];
  }),
  binanceVisionUsd().catch((e) => {
    console.error("binance.vision 실패:", String(e).slice(0, 120));
    return new Map<string, number>();
  }),
  loadUsdKrw(),
]);

if (!fx) {
  console.error("✗ 환율(USD/KRW) 조회 실패");
  process.exit(1);
}
if (upbit.length === 0 || usd.size === 0) {
  console.error(`✗ 소스 부족 — upbit ${upbit.length} / global ${usd.size}`);
  process.exit(1);
}

const snap = buildKimchiSnapshot(
  upbit.map((q) => ({symbol: q.symbol, price: q.price})),
  usd,
  fx,
  "Binance",
  Date.now()
);
if (!snap) {
  console.error("✗ 스냅샷 생성 실패 (유효 row 0)");
  process.exit(1);
}

console.log(
  `김치 ${snap.rows.length}종목 · 평균 ${snap.avgPremium.toFixed(2)}% · BTC ${snap.btc?.premiumPct.toFixed(2) ?? "—"}% · 환율 ${fx.rate} (${fx.source})`
);

const res = await fetch(`${SITE}/api/cron/kimchi`, {
  method: "POST",
  headers: {"Content-Type": "application/json", Authorization: `Bearer ${TOKEN}`},
  body: JSON.stringify(snap),
});
const text = await res.text();
console.log(`POST ${SITE}/api/cron/kimchi → ${res.status}: ${text.slice(0, 200)}`);
if (!res.ok) process.exit(1);
console.log("✓ KV 저장 완료");
