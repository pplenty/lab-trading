import type {AssetClass, Quote} from "@/lib/types";
import {absoluteUrl} from "@/lib/site";

// 자산군 인덱스 페이지 (`/crypto`, `/us`, `/kr`) ItemList JSON-LD.
// schema.org ItemList — 검색 엔진의 list rich result 인식 후보.

type Params = {
  class: AssetClass;
  locale: string;
  quotes: Quote[];
  /** 자산명 매핑 (registry 의 한글/영문명). */
  nameMap?: Record<string, {name: string; nameKo?: string}>;
  /** ItemList 의 사람-친화적 title (예: "코인 시세 인덱스"). */
  listName: string;
};

export function assetListJsonLd({
  class: cls,
  locale,
  quotes,
  nameMap,
  listName,
}: Params): string {
  const itemListElement = quotes.slice(0, 20).map((q, i) => {
    const meta = nameMap?.[q.symbol];
    const displayName = meta
      ? locale === "ko" && meta.nameKo
        ? meta.nameKo
        : meta.name
      : q.symbol.toUpperCase();
    return {
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(`/${locale}/${cls}/${q.symbol}`),
      name: displayName,
    };
  });

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: absoluteUrl(`/${locale}/${cls}`),
    numberOfItems: quotes.length,
    itemListElement,
  });
}
