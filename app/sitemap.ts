import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {absoluteUrl} from "@/lib/site";

// 1차 출시 활성 라우트만 sitemap 에 포함 (ADR-0015).
// stub 라우트 (kr/news/backtest-saved 등) 는 noindex 처리 — sitemap 누락.
// 종목 상세 페이지는 후속 PR 에서 D1 의 assets 테이블을 query 해 동적 추가.
//
// 1차 출시 인덱스 페이지:
//   - 홈 `/`
//   - /crypto, /crypto/gainers|losers|volume
//   - /us, /us/gainers|losers|volume
//   - /backtest/new
//   - /settings
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
  "/backtest/new",
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
