import {NextResponse} from "next/server";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo, D1IndicatorRepo} from "@/lib/db/d1/repos";
import {computeIndicators, INDICATORS_VERSION} from "@/lib/backfill/indicators-batch";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// indicators 재계산 route (ADR-0021).
//
// 외부 API 재호출 없이 D1 candles 만 읽어 indicators 만 재계산 + UPSERT.
// schema 확장 / 계산 로직 변경 / INDICATORS_VERSION 올림 후 일괄 재계산용.
//
// 호출 패턴 (worker timeout 30초 안에서 분할):
//   POST /api/recompute-indicators?symbol=btc       — 단일 종목 (CF Workers 안전)
//   POST /api/recompute-indicators?asset=crypto-upbit (전 종목 — local preview 만 권장)
//
// BACKFILL_TOKEN 인증 공용.

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  const auth = req.headers.get("authorization") ?? "";
  if (!token) return process.env.NODE_ENV !== "production";
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

type SymbolResult = {
  symbol: string;
  candlesRead: number;
  indicatorsInserted: number;
  error?: string;
};

async function recomputeOne(
  symbol: string,
  candleRepo: D1CandleRepo,
  indicatorRepo: D1IndicatorRepo
): Promise<SymbolResult> {
  try {
    // D1 candles 5년치 전체 read — orderBy asc, no limit.
    const now = Math.floor(Date.now() / 1000);
    const candles = await candleRepo.range({
      symbol,
      from: 0,
      to: now + 86400,
    });
    if (candles.length === 0) {
      return {symbol, candlesRead: 0, indicatorsInserted: 0};
    }
    const rows = computeIndicators(candles);
    const inserted = await indicatorRepo.upsertMany(
      symbol,
      INDICATORS_VERSION,
      rows
    );
    return {symbol, candlesRead: candles.length, indicatorsInserted: inserted};
  } catch (err) {
    return {
      symbol,
      candlesRead: 0,
      indicatorsInserted: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }
    const url = new URL(req.url);
    const singleSymbol = url.searchParams.get("symbol");
    const asset = url.searchParams.get("asset");

    if (!(await isDbAvailable())) {
      return NextResponse.json({error: "D1 unavailable"}, {status: 503});
    }
    const db = await getDb();
    const candleRepo = new D1CandleRepo(db);
    const indicatorRepo = new D1IndicatorRepo(db);

    let symbols: string[];
    if (singleSymbol) {
      symbols = [singleSymbol];
    } else if (asset) {
      symbols = symbolsFor(asset);
      if (symbols.length === 0) {
        return NextResponse.json(
          {error: `unknown asset ${asset}`, accept: ["crypto-upbit", "us", "kr"]},
          {status: 400}
        );
      }
    } else {
      return NextResponse.json(
        {error: "provide ?symbol=<symbol> or ?asset=<class>"},
        {status: 400}
      );
    }

    const started = Date.now();
    const results: SymbolResult[] = [];
    for (const s of symbols) {
      results.push(await recomputeOne(s, candleRepo, indicatorRepo));
    }
    const totalIndicators = results.reduce(
      (n, r) => n + r.indicatorsInserted,
      0
    );
    const errors = results.filter((r) => r.error).length;
    return NextResponse.json({
      ts: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      version: INDICATORS_VERSION,
      symbols: symbols.length,
      totalIndicators,
      errors,
      results,
    });
  } catch (err) {
    console.error("[recompute-indicators] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({error: message}, null, 2), {
      status: 500,
      headers: {"content-type": "application/json; charset=utf-8"},
    });
  }
}
