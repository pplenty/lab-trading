import {NextResponse} from "next/server";
import {backfillAssetClass} from "@/lib/backfill/run";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// 사용자 트리거 backfill — POST /api/backfill?asset=us&days=1825
// 보안: BACKFILL_TOKEN 환경 변수로 단순 인증. 미설정 시 dev only (production 거부).
// 응답: 종목별 BackfillResult 배열 (candlesInserted / indicatorsInserted / rangesFetched / error).
//
// 사용 예 (dev):
//   curl -X POST 'http://localhost:3000/api/backfill?asset=us&days=1825' \
//        -H 'Authorization: Bearer <BACKFILL_TOKEN>'

export const runtime = "edge";
export const dynamic = "force-dynamic";

const DAY_SEC = 86400;

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  // 프로덕션에선 토큰 필수. dev 에선 (development env) 토큰 없어도 허용.
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${token}`;
}

function symbolsFor(asset: string): string[] {
  switch (asset) {
    case "crypto-upbit":
      return cryptoRegistry.filter((e) => e.upbitMarket).map((e) => e.symbol);
    case "us":
      return usRegistry.map((e) => e.symbol);
    case "kr":
      return krRegistry.map((e) => e.symbol);
    default:
      return [];
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {error: "Unauthorized — set BACKFILL_TOKEN env or run in dev"},
      {status: 401}
    );
  }

  const url = new URL(req.url);
  const asset = url.searchParams.get("asset") ?? "us";
  const days = Math.max(
    1,
    Math.min(3650, Number(url.searchParams.get("days") ?? 1825))
  );

  if (!["crypto-upbit", "us", "kr"].includes(asset)) {
    return NextResponse.json(
      {error: `unknown asset: ${asset}`, accept: ["crypto-upbit", "us", "kr"]},
      {status: 400}
    );
  }

  const symbols = symbolsFor(asset);
  if (symbols.length === 0) {
    return NextResponse.json({error: "no symbols for asset"}, {status: 400});
  }

  const now = Math.floor(Date.now() / 1000);
  const fromT = now - days * DAY_SEC;

  try {
    const results = await backfillAssetClass({
      asset: asset as "crypto-upbit" | "us" | "kr",
      symbols,
      fromT,
      toT: now,
    });
    const totalCandles = results.reduce((s, r) => s + r.candlesInserted, 0);
    const totalIndicators = results.reduce(
      (s, r) => s + r.indicatorsInserted,
      0
    );
    const errors = results.filter((r) => r.error).length;
    return NextResponse.json({
      asset,
      days,
      symbols: symbols.length,
      totalCandles,
      totalIndicators,
      errors,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      {error: err instanceof Error ? err.message : String(err)},
      {status: 500}
    );
  }
}
