import {absoluteUrl} from "@/lib/site";

// 사이트 전체 schema (홈 페이지에만 박음).
// schema.org WebSite + SearchAction — Google 의 sitelinks searchbox 인식.
// 현재 통합 검색은 client-side 정적 인덱스 (헤더 listbox) — Phase 2 에 /search?q=... 페이지
// 도입 시 target URL 만 변경.

export function siteJsonLd(locale: string): string {
  const url = absoluteUrl(`/${locale}`);
  const home = absoluteUrl("/");
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "trading",
    alternateName: "Lab Trading",
    description:
      "코인 · 해외주식 · 국내주식 통합 정보 사이트 + 일봉 백테스트 랩",
    url,
    inLanguage: locale,
    publisher: {
      "@type": "Organization",
      name: "trading",
      url: home,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl(`/${locale}/search?q={search_term_string}`),
      },
      "query-input": "required name=search_term_string",
    },
  };
  return JSON.stringify(data);
}
