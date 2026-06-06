import {NextResponse} from "next/server";
import {setKvJson} from "@/lib/cache/kv-json";
import {KIMCHI_KV_KEY, type KimchiSnapshot} from "@/lib/data/kimchi";

// 김치 프리미엄 스냅샷 수신 → KV 저장. cron(node, scripts/compute-kimchi.ts)이 계산해 POST.
// Upbit·Binance·CoinGecko 라이브 호출이 CF Worker 에서 불안정해 계산을 node 로 외부화한 패턴
// (lib/data/kimchi.ts 주석 참조). Worker 페이지는 loadKimchiFromKv 로 읽기만.
//
// POST /api/cron/kimchi  (Authorization: Bearer <BACKFILL_TOKEN>)  body: KimchiSnapshot JSON

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  if (!token) return process.env.NODE_ENV !== "production";
  return (req.headers.get("authorization") ?? "") === `Bearer ${token}`;
}

// 저장 전 최소 형태 검증 (garbage KV write 방지).
function isValidSnapshot(v: unknown): v is KimchiSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    Array.isArray(s.rows) &&
    s.rows.length > 0 &&
    typeof s.avgPremium === "number" &&
    typeof s.updatedAt === "number" &&
    !!s.fx &&
    typeof (s.fx as Record<string, unknown>).rate === "number"
  );
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {error: "Unauthorized — set BACKFILL_TOKEN env or run in dev"},
        {status: 401}
      );
    }
    const body = await req.json().catch(() => null);
    if (!isValidSnapshot(body)) {
      return NextResponse.json(
        {error: "invalid snapshot — rows[]/avgPremium/fx.rate/updatedAt 필요"},
        {status: 400}
      );
    }
    // 6h TTL — cron 주기(~15min) 보다 충분히 길어 갱신 사이 공백 없음. cron 중단 시 6h 후 자연 만료.
    await setKvJson(KIMCHI_KV_KEY, body, {ttlSeconds: 6 * 60 * 60});
    return NextResponse.json({
      ok: true,
      rows: body.rows.length,
      avgPremium: Number(body.avgPremium.toFixed(2)),
      usdSource: body.usdSource,
    });
  } catch (err) {
    return NextResponse.json(
      {error: err instanceof Error ? err.message : String(err)},
      {status: 500}
    );
  }
}
