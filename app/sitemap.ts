import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {absoluteUrl} from "@/lib/site";

// 활성 라우트만 sitemap 에 포함. stub (news / kospi-only / kosdaq-only) noindex.
// /search 는 generateMetadata 에서 robots noindex (검색 결과 페이지 관행).
// 종목 상세는 후속 PR 에서 D1 assets 테이블 query 로 동적 추가.
const STATIC_PATHS = [
  "",
  "/crypto",
  "/crypto/gainers",
  "/crypto/losers",
  "/crypto/volume",
  "/us",
  "/us/gainers",
  "/us/losers",
  "/us/volume",
  "/kr",
  "/kr/gainers",
  "/kr/losers",
  "/kr/volume",
  "/backtest/new",
  "/backtest/saved",
  "/settings",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = routing.locales;
  const entries: MetadataRoute.Sitemap = [];

  const altLanguages = (pathFn: (locale: string) => string) => ({
    languages: Object.fromEntries(
      locales.map((l) => [l, absoluteUrl(pathFn(l))])
    ),
  });

  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1.0 : 0.7,
        alternates: altLanguages((l) => `/${l}${path}`),
      });
    }
  }

  return entries;
}
