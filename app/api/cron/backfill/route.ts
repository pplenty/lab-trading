import {NextResponse} from "next/server";
import {incrementalBackfill} from "@/lib/backfill/run";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// CF Workers Cron Trigger 가 호출하는 증분 backfill.
// `wrangler.jsonc` 의 `triggers.crons: ["0 6 * * *"]` 매일 06:00 UTC (15:00 KST, KOSPI 폐장 후).
// CF Cron 요청은 `cf-worker` user-agent + scheduled time header — Workers 표준.
// 또는 외부 cron 서비스 (CF Workflows, GitHub Actions) 가 BACKFILL_TOKEN 으로 호출.

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  // CF Cron 자체 호출은 internal — `cf-worker` 헤더 또는 별도 인증.
  // 외부 호출은 토큰 필수.
  const auth = req.headers.get("authorization") ?? "";
  const isCfCron =
    req.headers.get("cf-cron") !== null ||
    req.headers.get("cf-worker") !== null;
  if (isCfCron) return true;
  if (!token) return process.env.NODE_ENV !== "production";
  return auth === `Bearer ${token}`;
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const started = Date.now();
  const cryptoSymbols = cryptoRegistry
    .filter((e) => e.upbitMarket)
    .map((e) => e.symbol);
  const usSymbols = usRegistry.map((e) => e.symbol);
  const krSymbols = krRegistry.map((e) => e.symbol);

  const [crypto, us, kr] = await Promise.allSettled([
    incrementalBackfill({asset: "crypto-upbit", symbols: cryptoSymbols}),
    incrementalBackfill({asset: "us", symbols: usSymbols}),
    incrementalBackfill({asset: "kr", symbols: krSymbols}),
  ]);

  function summarize(label: string, r: PromiseSettledResult<unknown>) {
    if (r.status === "rejected") {
      return {label, error: String(r.reason)};
    }
    const results = r.value as Array<{
      candlesInserted: number;
      indicatorsInserted: number;
      error?: string;
    }>;
    return {
      label,
      candles: results.reduce((s, x) => s + x.candlesInserted, 0),
      indicators: results.reduce((s, x) => s + x.indicatorsInserted, 0),
      errors: results.filter((x) => x.error).length,
    };
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    crypto: summarize("crypto-upbit", crypto),
    us: summarize("us", us),
    kr: summarize("kr", kr),
  });
}
