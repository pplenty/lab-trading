import type {AssetClass, Quote} from "@/lib/types";
import {absoluteUrl} from "@/lib/site";

// 종목 상세 페이지 JSON-LD 스키마 (ADR-0015 D 컨벤션).
// schema.org — 주식은 `FinancialProduct`, 코인은 `Product` (컨벤션 D 정합).
// FinancialProduct 는 증권/투자상품 의미가 강해 암호화폐엔 Product 가 더 적합.
// 둘 다 offers (Offer) 로 가격 표현 가능.

type Params = {
  class: AssetClass;
  symbol: string;
  ticker: string;
  name: string;
  nameKo?: string;
  market?: string;
  locale: string;
  quote?: Quote | null;
};

export function assetJsonLd({
  class: cls,
  symbol,
  ticker,
  name,
  nameKo,
  market,
  locale,
  quote,
}: Params): string {
  const url = absoluteUrl(`/${locale}/${cls}/${symbol}`);
  const displayName = locale === "ko" && nameKo ? nameKo : name;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": cls === "crypto" ? "Product" : "FinancialProduct",
    name: displayName,
    alternateName: name !== displayName ? name : undefined,
    identifier: ticker,
    category: cls === "crypto" ? "Cryptocurrency" : "Stock",
    url,
    inLanguage: locale,
  };

  if (market) {
    data.provider = {
      "@type": "Organization",
      name: market,
    };
  }

  if (quote) {
    data.offers = {
      "@type": "Offer",
      price: quote.price,
      priceCurrency: quote.currency,
      availability: "https://schema.org/InStock",
      url,
      validFrom: quote.updatedAt,
    };
  }

  // BreadcrumbList — 검색 결과에 sub-route 노출.
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "trading",
        item: absoluteUrl(`/${locale}`),
      },
      {
        "@type": "ListItem",
        position: 2,
        name:
          cls === "crypto" ? "코인" : cls === "us" ? "해외주식" : "국내주식",
        item: absoluteUrl(`/${locale}/${cls}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${displayName} (${ticker})`,
        item: url,
      },
    ],
  };

  // 두 schema 를 array 로 묶으면 단일 <script> 에 박을 수 있음.
  return JSON.stringify([data, breadcrumb]);
}
