import type {NextRequest} from "next/server";
import {saveShare, type SharedBacktest} from "@/lib/share/backtest";

// 백테스트 결과 공유 — client 가 결과 + meta 를 POST → KV 저장 + short id 반환.
// 친구에게 /backtest/share/<id> URL 전달.

export const dynamic = "force-dynamic";

// payload 크기 sanity check (~200KB 정도가 5y daily candles + indicators 평균)
const MAX_BYTES = 800 * 1024;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) {
      return Response.json({error: "payload too large"}, {status: 413});
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({error: "invalid json"}, {status: 400});
  }
  const data = body as Partial<SharedBacktest>;
  // minimal validation — 필수 필드만 확인
  if (
    !data ||
    typeof data.asset !== "string" ||
    typeof data.symbol !== "string" ||
    typeof data.strategyId !== "string" ||
    !data.result ||
    !Array.isArray(data.candles)
  ) {
    return Response.json({error: "invalid payload"}, {status: 400});
  }
  if (data.asset !== "crypto" && data.asset !== "us" && data.asset !== "kr") {
    return Response.json({error: "invalid asset"}, {status: 400});
  }
  const id = await saveShare({
    asset: data.asset,
    symbol: data.symbol,
    displayName: data.displayName ?? data.symbol.toUpperCase(),
    displayTicker: data.displayTicker ?? data.symbol.toUpperCase(),
    currency: data.currency ?? "USD",
    strategyId: data.strategyId,
    params: data.params ?? {},
    tf: data.tf ?? "1d",
    initialCapital: data.initialCapital ?? 1_000_000,
    candles: data.candles,
    result: data.result,
    createdAt: new Date().toISOString(),
    note: typeof data.note === "string" ? data.note.slice(0, 200) : undefined,
  });
  return Response.json({id});
}
