import {NextResponse} from "next/server";

// 운영 헬스 체크 — Cloudflare Workers 모니터링 / uptime probe / 외부 health check.
// 응답은 JSON. 의도적으로 작고 결정적 — 외부 API 의존성 0 (어댑터 호출 안 함).
// 어댑터 키 발급 여부는 server-side env 확인으로 단순 boolean. 키 값 자체는 노출 X.

export const runtime = "edge";
export const dynamic = "force-dynamic";

const VERSION = "0.1.0";

export async function GET() {
  const env =
    typeof process !== "undefined" && process.env
      ? process.env
      : ({} as NodeJS.ProcessEnv);

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
      site: env.NEXT_PUBLIC_SITE_URL ?? null,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}
