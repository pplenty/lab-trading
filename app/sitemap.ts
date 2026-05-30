import type {MetadataRoute} from "next";
import {sql} from "drizzle-orm";
import {routing} from "@/i18n/routing";
import {absoluteUrl} from "@/lib/site";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import * as schema from "@/lib/db/d1/schema";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// sitemap 에는 **검색 색인 대상 (index 가능) 공개 페이지만** 포함한다.
// robots:{index:false} 인 사용자 자산 페이지 (alerts/notes/portfolio/favorites/me/
// backtest-custom/vs/portfolio/saved/settings) 와 빈 진입 noindex (/compare) 는 제외 —
// sitemap 에 noindex URL 등재 시 GSC "Submitted URL marked noindex" 에러 + sitemap 신뢰도 하락.
const STATIC_PATHS = [
  "",
  "/news",
  "/crypto",
  "/crypto/gainers",
  "/crypto/losers",
  "/crypto/volume",
  "/crypto/news",
  "/us",
  "/us/gainers",
  "/us/losers",
  "/us/volume",
  "/us/news",
  "/kr",
  "/kr/kospi",
  "/kr/kosdaq",
  "/kr/gainers",
  "/kr/losers",
  "/kr/volume",
  "/kr/news",
  "/backtest/new",
  "/market",
  "/indices",
];

// 일별 갱신 (시세/뉴스 변동) — changeFrequency daily, priority 0.8.
const DAILY_PATHS = new Set([
  "/news",
  "/crypto",
  "/crypto/gainers",
  "/crypto/losers",
  "/crypto/volume",
  "/crypto/news",
  "/us",
  "/us/gainers",
  "/us/losers",
  "/us/volume",
  "/us/news",
  "/kr",
  "/kr/kospi",
  "/kr/kosdaq",
  "/kr/gainers",
  "/kr/losers",
  "/kr/volume",
  "/kr/news",
  "/indices",
  "/market",
]);

function symbolPaths(): string[] {
  const paths: string[] = [];
  for (const e of cryptoRegistry) {
    if (e.upbitMarket) paths.push(`/crypto/${e.symbol}`);
  }
  for (const e of usRegistry) paths.push(`/us/${e.symbol}`);
  for (const e of krRegistry) paths.push(`/kr/${e.symbol}`);
  return paths;
}

/** 단일 round-trip 으로 최신 봉 시각(unix sec) 조회. D1 미가용 또는 실패 시 null. */
async function loadLastMod(): Promise<Date | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select({latestT: sql<number | null>`(SELECT MAX(t) FROM candles)`})
      .from(schema.candles)
      .limit(1);
    const t = rows[0]?.latestT ?? null;
    return t ? new Date(t * 1000) : null;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ADR-0004: 1차 출시는 ko 단독. routing.locales 의 "en" 은 인프라 보존용이지만
  // sitemap 에 노출하지 않는다 (/en/* 는 middleware 가 /ko/* 로 308 redirect — SEO 중복 회피).
  const locales = ["ko"] as const;
  const entries: MetadataRoute.Sitemap = [];

  // lastmod = D1 최신 봉 날짜 (모든 페이지가 동일 cron 으로 일괄 갱신되므로 단일 신호 OK).
  // 정직한 freshness 시그널 — 1주일째 stale 이면 Google 도 그렇게 인지.
  const lastModified = await loadLastMod();

  const symbolPath = symbolPaths();
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      const isDaily = path === "" || DAILY_PATHS.has(path);
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: isDaily ? "daily" : "weekly",
        priority: path === "" ? 1.0 : DAILY_PATHS.has(path) ? 0.8 : 0.6,
        ...(lastModified ? {lastModified} : {}),
      });
    }
    // 종목 상세 — daily 갱신 (시세 변동), priority 0.8 (랭킹 0.7 보다 약간 높게)
    for (const path of symbolPath) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: "daily",
        priority: 0.8,
        ...(lastModified ? {lastModified} : {}),
      });
    }
  }

  return entries;
}
