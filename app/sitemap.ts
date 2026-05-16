import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {absoluteUrl} from "@/lib/site";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";

// 활성 라우트 + 35 종목 상세를 sitemap 에 포함.
// stub (news / kospi-only / kosdaq-only) noindex.
// /search 는 generateMetadata 에서 robots noindex (검색 결과 페이지 관행).
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

function symbolPaths(): string[] {
  const paths: string[] = [];
  for (const e of cryptoRegistry) {
    if (e.upbitMarket) paths.push(`/crypto/${e.symbol}`);
  }
  for (const e of usRegistry) paths.push(`/us/${e.symbol}`);
  for (const e of krRegistry) paths.push(`/kr/${e.symbol}`);
  return paths;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = routing.locales;
  const entries: MetadataRoute.Sitemap = [];

  const altLanguages = (pathFn: (locale: string) => string) => ({
    languages: Object.fromEntries(
      locales.map((l) => [l, absoluteUrl(pathFn(l))])
    ),
  });

  const symbolPath = symbolPaths();
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1.0 : 0.7,
        alternates: altLanguages((l) => `/${l}${path}`),
      });
    }
    // 종목 상세 — daily 갱신 (시세 변동), priority 0.8 (랭킹 0.7 보다 약간 높게)
    for (const path of symbolPath) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: "daily",
        priority: 0.8,
        alternates: altLanguages((l) => `/${l}${path}`),
      });
    }
  }

  return entries;
}
