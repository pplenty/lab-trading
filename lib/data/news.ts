import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1NewsRepo, type NewsArticleRow} from "@/lib/db/d1/repos";
import {keywordsForSymbol} from "@/lib/symbols/news-keywords";

// 뉴스 read 진입점 — KV hot cache 우선 → D1 fallback (ADR-0008).
//
// 흐름:
//   1) KV `news:{class}` — 최근 5분 이내 cron 가 채워둔 JSON. 즉시 응답.
//   2) miss / KV 없음 → D1 query (D1NewsRepo.listByAsset).
//   3) D1 미설정 → 빈 배열.

const KV_TTL_SEC = 600; // 10분 — cron 5-30분 주기 안에 자연 만료
const PAGE_LIMIT = 30;

export type NewsArticleView = {
  url: string;
  title: string;
  summary: string | null;
  source: string;
  publishedAt: number; // unix sec
};

function toView(r: NewsArticleRow): NewsArticleView {
  return {
    url: r.url,
    title: r.title,
    summary: r.summary,
    source: r.source,
    publishedAt: r.published_at,
  };
}

async function getKv(): Promise<KVNamespace | null> {
  try {
    const {getCloudflareContext} = await import("@opennextjs/cloudflare");
    let env: unknown;
    try {
      env = getCloudflareContext().env;
    } catch {
      env = (await getCloudflareContext({async: true})).env;
    }
    const e = env as {lab_trading_cache?: KVNamespace};
    return e.lab_trading_cache ?? null;
  } catch {
    return null;
  }
}

export async function loadNewsByClass(
  asset: AssetClass,
  limit: number = PAGE_LIMIT
): Promise<{articles: NewsArticleView[]; source: "kv" | "d1" | "empty"}> {
  // 1) KV hot cache
  const kv = await getKv();
  if (kv) {
    try {
      const raw = await kv.get(`news:${asset}`, "json");
      if (raw && Array.isArray(raw)) {
        return {
          articles: (raw as NewsArticleView[]).slice(0, limit),
          source: "kv",
        };
      }
    } catch {
      // KV miss / parse error — D1 로 폴백
    }
  }

  // 2) D1
  if (await isDbAvailable()) {
    try {
      const db = await getDb();
      const repo = new D1NewsRepo(db);
      const rows = await repo.listByAsset(asset, limit);
      return {articles: rows.map(toView), source: "d1"};
    } catch {
      // D1 query 실패 — 빈 배열
    }
  }

  return {articles: [], source: "empty"};
}

/**
 * 특정 종목 관련 뉴스 — D1 only (KV cache 자산군 단위라 종목 매칭은 매번 D1 LIKE).
 * 빈 keyword 또는 D1 미가용 시 빈 배열. SSR 에서 종목 상세 페이지가 호출.
 */
export async function loadNewsBySymbol(
  asset: AssetClass,
  symbol: string,
  limit: number = 5
): Promise<NewsArticleView[]> {
  const keywords = keywordsForSymbol(asset, symbol);
  if (keywords.length === 0) return [];
  if (!(await isDbAvailable())) return [];
  try {
    const db = await getDb();
    const repo = new D1NewsRepo(db);
    const rows = await repo.listBySymbol({asset, keywords, limit});
    return rows.map(toView);
  } catch {
    return [];
  }
}

/** cron route 가 호출 — D1 UPSERT 후 KV hot cache 갱신. */
export async function refreshNewsKv(
  byAsset: Record<AssetClass, NewsArticleView[]>
): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await Promise.all(
    (Object.entries(byAsset) as [AssetClass, NewsArticleView[]][]).map(
      ([asset, articles]) =>
        kv.put(`news:${asset}`, JSON.stringify(articles), {
          expirationTtl: KV_TTL_SEC,
        })
    )
  );
}

// 워크 호환 KV 타입 — 별도 import 필요시 lib 에 있음
type KVNamespace = {
  get(key: string, type?: "text" | "json"): Promise<unknown>;
  put(
    key: string,
    value: string,
    opts?: {expirationTtl?: number}
  ): Promise<void>;
};
