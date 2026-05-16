import {NextResponse} from "next/server";
import {loadQuotesList} from "@/lib/data/quotes";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// KV 캐시 warm-up cron — 대시보드 / 인덱스 SSR 의 첫 사용자도 KV hit 유도.
//
// 흐름:
//   1) 3 자산군 loadQuotesList 호출 (KV miss → adapter → KV write)
//   2) 응답에 elapsed + 자산군별 quote 수
// BACKFILL_TOKEN 공용 인증. GitHub Actions 5분 주기 호출.

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  const auth = req.headers.get("authorization") ?? "";
  if (!token) return process.env.NODE_ENV !== "production";
  return auth === `Bearer ${token}`;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  const started = Date.now();

  // 3 자산군 병렬 warmup — 각자 KV write 까지 완료
  const [crypto, us, kr] = await Promise.allSettled([
    loadQuotesList({
      asset: "crypto",
      symbols: cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol),
      listOpts: {limit: 50},
    }),
    loadQuotesList({
      asset: "us",
      symbols: usRegistry.map((e) => e.symbol),
      listOpts: {limit: 50},
    }),
    loadQuotesList({
      asset: "kr",
      symbols: krRegistry.map((e) => e.symbol),
      listOpts: {limit: 50},
    }),
  ]);

  function summarize(label: string, r: PromiseSettledResult<unknown>) {
    if (r.status === "rejected") {
      return {label, error: String(r.reason)};
    }
    return {label, count: (r.value as unknown[]).length};
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    crypto: summarize("crypto", crypto),
    us: summarize("us", us),
    kr: summarize("kr", kr),
  });
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
