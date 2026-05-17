import {NextResponse} from "next/server";
import {fetchAllSources} from "@/lib/adapters/rss";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1NewsRepo} from "@/lib/db/d1/repos";
import {refreshNewsKv, type NewsArticleView} from "@/lib/data/news";
import type {AssetClass} from "@/lib/types";

// 뉴스 RSS 수집 cron 진입점 (ADR-0008).
//
// 흐름:
//   1) 6 매체 RSS 병렬 fetch + normalize + 자산군 매핑
//   2) D1 news_articles UPSERT (url_hash 충돌 시 title/summary/published_at 갱신)
//   3) 자산군별 최근 30 article 을 KV hot cache 에 write
//
// 인증: BACKFILL_TOKEN Bearer (GitHub Actions cron + 외부 트리거 공용).
// 응답: 매체별 fetched / errors + 자산군별 D1 count.

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const token =
    typeof process !== "undefined" ? process.env.BACKFILL_TOKEN : undefined;
  const auth = req.headers.get("authorization") ?? "";
  // CF Cron 자체 호출은 internal — 일부 헤더 또는 별도 인증.
  const isCfCron =
    req.headers.get("cf-cron") !== null ||
    req.headers.get("cf-worker") !== null;
  if (isCfCron) return true;
  if (!token) return process.env.NODE_ENV !== "production";
  return auth === `Bearer ${token}`;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  const started = Date.now();
  // 1) fetch
  const {articles, errors} = await fetchAllSources();

  // 2) D1 UPSERT
  let upserted = 0;
  const d1Available = await isDbAvailable();
  let d1UpsertError: string | null = null;
  if (d1Available) {
    try {
      const db = await getDb();
      const repo = new D1NewsRepo(db);
      upserted = await repo.upsertMany(articles);
    } catch (err) {
      d1UpsertError = err instanceof Error ? err.message : String(err);
    }
  }

  // 3) KV hot cache — 자산군별 최근 30
  const byAsset: Record<AssetClass, NewsArticleView[]> = {
    crypto: [],
    us: [],
    kr: [],
  };
  // 자산군 매핑 + 최신순 정렬
  for (const a of articles) {
    for (const cls of a.asset_classes) {
      byAsset[cls].push({
        url: a.url,
        title: a.title,
        summary: a.summary,
        source: a.source,
        publishedAt: a.published_at,
      });
    }
  }
  for (const cls of ["crypto", "us", "kr"] as AssetClass[]) {
    byAsset[cls].sort((a, b) => b.publishedAt - a.publishedAt);
    byAsset[cls] = byAsset[cls].slice(0, 30);
  }
  await refreshNewsKv(byAsset);

  // counts per source
  const bySource = new Map<string, number>();
  for (const a of articles) {
    bySource.set(a.source_key, (bySource.get(a.source_key) ?? 0) + 1);
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    d1Available,
    d1UpsertError,
    upserted,
    fetched: articles.length,
    bySource: Object.fromEntries(bySource),
    byAsset: {
      crypto: byAsset.crypto.length,
      us: byAsset.us.length,
      kr: byAsset.kr.length,
    },
    fetchErrors: errors,
  });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
