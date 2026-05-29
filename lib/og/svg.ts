import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import type {Candle} from "@/lib/types";

// 동적 OG endpoint (app/api/og/...) 진입점.
// SVG 빌더·메타는 D1 비의존 lib/og/card.ts 에 있고, 여기서는 D1 봉 로드만 추가한다.
// (정적 PNG 생성 scripts/gen-og.ts 는 card.ts 만 import → D1 없이 동작.)
export {
  OG_WIDTH,
  OG_HEIGHT,
  getOgMeta,
  formatPrice,
  buildOgSvg,
  buildStaticOgSvg,
} from "@/lib/og/card";
export type {SymbolMeta} from "@/lib/og/card";

export async function loadRecentCandles(
  symbol: string,
  limit: number = 60
): Promise<Candle[]> {
  if (!(await isDbAvailable())) return [];
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    const rows = await repo.range({
      symbol,
      from: now - limit * 86400 * 1.7,
      to: now + 86400,
    });
    return rows.slice(-limit);
  } catch {
    return [];
  }
}
