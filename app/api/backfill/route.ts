import {NextResponse} from "next/server";
import {backfillAssetClass, backfillSymbol} from "@/lib/backfill/run";
import {upbitAdapter} from "@/lib/adapters/upbit";
import {twelveDataAdapter} from "@/lib/adapters/twelve-data";
import {kisAdapter} from "@/lib/adapters/kis";
import type {DataAdapter} from "@/lib/adapters/types";
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
  // 전체를 try/catch — isAuthorized / URL 파싱 등에서 throw 도 응답에 노출.
  try {
    console.log("[backfill] start", req.url);

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
    // 단일 종목 모드 — CF Workers 30초 한도 안에서 끝내려면 종목 분할이 안전.
    // 호출자(외부 cron / 스크립트)가 종목 목록을 순차 호출.
    const singleSymbol = url.searchParams.get("symbol") ?? undefined;

    if (!["crypto-upbit", "us", "kr"].includes(asset)) {
      return NextResponse.json(
        {error: `unknown asset: ${asset}`, accept: ["crypto-upbit", "us", "kr"]},
        {status: 400}
      );
    }

    const allSymbols = symbolsFor(asset);
    const symbols = singleSymbol ? [singleSymbol] : allSymbols;
    if (symbols.length === 0) {
      return NextResponse.json({error: "no symbols for asset"}, {status: 400});
    }
    if (singleSymbol && !allSymbols.includes(singleSymbol)) {
      return NextResponse.json(
        {error: `unknown symbol ${singleSymbol} for ${asset}`, accept: allSymbols},
        {status: 400}
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const fromT = now - days * DAY_SEC;

    console.log(
      `[backfill] asset=${asset} symbols=${symbols.length} days=${days} single=${singleSymbol ?? "-"}`
    );

    // 단일 종목 모드는 backfillSymbol 직호출 — 더 적은 오버헤드.
    let results;
    if (singleSymbol) {
      const adapterMap: Record<
        string,
        {adapter: DataAdapter; dpc: number; delayMs: number}
      > = {
        "crypto-upbit": {adapter: upbitAdapter, dpc: 200, delayMs: 0},
        us: {adapter: twelveDataAdapter, dpc: 5000, delayMs: 0},
        kr: {adapter: kisAdapter, dpc: 100, delayMs: 1100},
      };
      const cfg = adapterMap[asset];
      const r = await backfillSymbol({
        adapter: cfg.adapter,
        daysPerCall: cfg.dpc,
        symbol: singleSymbol,
        fromT,
        toT: now,
        delayMs: cfg.delayMs,
      });
      results = [r];
    } else {
      results = await backfillAssetClass({
        asset: asset as "crypto-upbit" | "us" | "kr",
        symbols,
        fromT,
        toT: now,
      });
    }
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
    console.error("[backfill] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack =
      err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, 15)
        : undefined;
    return new Response(
      JSON.stringify({error: message, stack}, null, 2),
      {
        status: 500,
        headers: {"content-type": "application/json; charset=utf-8"},
      }
    );
  }
}
