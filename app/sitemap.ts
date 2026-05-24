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
  "/backtest/portfolio",
  "/backtest/saved",
  "/compare",
  "/market",
  "/alerts",
  "/notes",
  "/portfolio",
  "/favorites",
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
  // ADR-0004: 1차 출시는 ko 단독. routing.locales 의 "en" 은 인프라 보존용이지만
  // sitemap 에 노출하지 않는다 (/en/* 는 middleware 가 /ko/* 로 308 redirect — SEO 중복 회피).
  const locales = ["ko"] as const;
  const entries: MetadataRoute.Sitemap = [];

  const symbolPath = symbolPaths();
  for (const locale of locales) {
    for (const path of STATIC_PATHS) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1.0 : 0.7,
      });
    }
    // 종목 상세 — daily 갱신 (시세 변동), priority 0.8 (랭킹 0.7 보다 약간 높게)
    for (const path of symbolPath) {
      entries.push({
        url: absoluteUrl(`/${locale}${path}`),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }

  return entries;
}
