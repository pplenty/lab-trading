import {NextResponse} from "next/server";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {sql} from "drizzle-orm";
import * as schema from "@/lib/db/d1/schema";

// 운영 헬스 체크 — Cloudflare Workers 모니터링 / uptime probe / 외부 health check.
// 응답: 어댑터 키 보유 boolean + D1 binding 가용성 + 데이터 신선도 (candles count, latestT).
// 키 값 자체는 노출 X.

export const dynamic = "force-dynamic";

const VERSION = "0.1.0";
const DAY_SEC = 86400;

type D1Stats = {
  available: boolean;
  candles?: number;
  indicators?: number;
  symbols?: number;
  latestTs?: string;
  staleDays?: number;
  error?: string;
};

async function loadD1Stats(): Promise<D1Stats> {
  if (!(await isDbAvailable())) return {available: false};
  try {
    const db = await getDb();
    // 단일 쿼리에서 한꺼번에 — 작은 D1 라 round-trip 최소화
    const rows = await db
      .select({
        candles: sql<number>`(SELECT COUNT(*) FROM candles)`,
        indicators: sql<number>`(SELECT COUNT(*) FROM indicators)`,
        symbols: sql<number>`(SELECT COUNT(DISTINCT symbol) FROM candles)`,
        latestT: sql<number | null>`(SELECT MAX(t) FROM candles)`,
      })
      .from(schema.candles)
      .limit(1);
    const r = rows[0];
    const latestT = r?.latestT ?? null;
    const now = Math.floor(Date.now() / 1000);
    return {
      available: true,
      candles: Number(r?.candles ?? 0),
      indicators: Number(r?.indicators ?? 0),
      symbols: Number(r?.symbols ?? 0),
      latestTs: latestT ? new Date(latestT * 1000).toISOString() : undefined,
      staleDays: latestT ? Math.floor((now - latestT) / DAY_SEC) : undefined,
    };
  } catch (err) {
    return {
      available: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const env =
    typeof process !== "undefined" && process.env
      ? process.env
      : ({} as NodeJS.ProcessEnv);

  const d1 = await loadD1Stats();

  return NextResponse.json(
    {
      status: "ok",
      version: VERSION,
      ts: new Date().toISOString(),
      adapters: {
        upbit: "live",
        binance: "live",
        coingecko: env.COINGECKO_API_KEY ? "keyed" : "anonymous",
        twelveData: env.TWELVE_DATA_API_KEY ? "live" : "demo",
        kis: env.KIS_APP_KEY && env.KIS_APP_SECRET ? "live" : "demo",
      },
      d1,
      site: env.NEXT_PUBLIC_SITE_URL ?? null,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
