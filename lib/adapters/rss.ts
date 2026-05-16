import {XMLParser} from "fast-xml-parser";
import type {AssetClass} from "@/lib/types";

// 한국 금융 RSS 어댑터 (ADR-0008).
// 매체별 fetcher + 통일 schema normalizer + 자산군 매핑 (디폴트 + 제목 키워드).
// CF Workers 호환 — fetch + fast-xml-parser (0-dep, Workers 안전).
//
// 본 어댑터는 *fetch + normalize only*. 저장은 D1NewsRepo, hot cache 는 KV — lib/data/news.ts.

// ──────────────────────────────────────────────────────────────────────────
// 매체 메타

export type NewsSourceKey =
  | "hankyung-stock"
  | "hankyung-economy"
  | "mk-stock"
  | "fnnews-stock"
  | "fnnews-finance"
  | "tokenpost";

export type NewsSource = {
  key: NewsSourceKey;
  /** 사람 친화 표기 — 카드에 노출. */
  label: string;
  url: string;
  /** 매체 디폴트 자산군 매핑. 추가 자산군은 제목 키워드로 보강. */
  defaultAssets: AssetClass[];
};

// URL 은 2026-05 기준 검증 — 매체가 RSS 구조 자주 바꿔 정기 점검 필요.
// 한경: 구 rss.hankyung.com 도메인 폐기 → www.hankyung.com/feed/<category> (xml 확장자 없음).
// 매경: file.mk.co.kr RSS 본문 빈 응답 → www.mk.co.kr/rss/<code>/ 로 이전.
// fnnews: http://www → https://www 로 + /rss/r20/ prefix 추가.
export const NEWS_SOURCES: NewsSource[] = [
  {
    key: "hankyung-stock",
    label: "한국경제 금융",
    url: "https://www.hankyung.com/feed/finance",
    defaultAssets: ["kr"],
  },
  {
    key: "hankyung-economy",
    label: "한국경제",
    url: "https://www.hankyung.com/feed/economy",
    defaultAssets: ["kr"],
  },
  {
    key: "mk-stock",
    label: "매일경제",
    url: "https://www.mk.co.kr/rss/30000001/",
    defaultAssets: ["kr"],
  },
  {
    key: "fnnews-stock",
    label: "파이낸셜뉴스 증권",
    url: "https://www.fnnews.com/rss/r20/fn_realnews_stock.xml",
    defaultAssets: ["kr"],
  },
  {
    key: "fnnews-finance",
    label: "파이낸셜뉴스 금융",
    url: "https://www.fnnews.com/rss/r20/fn_realnews_finance.xml",
    defaultAssets: ["kr"],
  },
  {
    key: "tokenpost",
    label: "토큰포스트",
    url: "https://www.tokenpost.kr/rss",
    defaultAssets: ["crypto"],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// 자산군 키워드 (제목 분석)

/**
 * 매체 디폴트 자산군 외 제목 키워드로 추가 매핑.
 * 한국어 매체 특성상 코인/미장이 한국 매체에도 자주 등장 — 키워드 매칭으로 cross-tag.
 */
const ASSET_KEYWORDS: Record<AssetClass, string[]> = {
  crypto: [
    "비트코인", "이더리움", "리플", "도지", "솔라나", "암호화폐",
    "가상자산", "코인", "블록체인", "스테이블코인", "BTC", "ETH",
    "NFT", "디파이", "DeFi",
  ],
  us: [
    "뉴욕증시", "다우", "S&P", "나스닥", "월가", "FOMC", "연준",
    "테슬라", "애플", "마이크로소프트", "엔비디아", "구글", "메타",
    "아마존", "버크셔", "AAPL", "MSFT", "NVDA", "TSLA",
  ],
  kr: [
    "코스피", "코스닥", "삼성전자", "SK하이닉스", "현대차", "LG",
    "POSCO", "네이버", "카카오", "셀트리온", "한국증시", "KOSPI",
  ],
};

/** 제목/요약에서 추가 자산군 추출. defaultAssets 와 합쳐 unique 반환. */
export function inferAssetClasses(
  defaults: AssetClass[],
  title: string,
  summary: string | undefined
): AssetClass[] {
  const text = `${title} ${summary ?? ""}`;
  const detected = new Set<AssetClass>(defaults);
  for (const [cls, keywords] of Object.entries(ASSET_KEYWORDS) as [
    AssetClass,
    string[],
  ][]) {
    if (keywords.some((k) => text.includes(k))) {
      detected.add(cls);
    }
  }
  return Array.from(detected);
}

// ──────────────────────────────────────────────────────────────────────────
// 정규화

export type RssItem = {
  url: string;
  title: string;
  summary: string | undefined;
  publishedAt: number; // unix sec
};

export type NormalizedArticle = {
  url: string;
  url_hash: string;
  title: string;
  summary: string | null;
  published_at: number;
  source: string;
  source_key: NewsSourceKey;
  asset_classes: AssetClass[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

/** RFC822 / ISO 8601 → unix sec. parse 실패 시 now. */
function parseDate(raw: string | undefined): number {
  if (!raw) return Math.floor(Date.now() / 1000);
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return Math.floor(Date.now() / 1000);
  return Math.floor(t / 1000);
}

/** HTML 태그 / CDATA 제거 + entity 디코딩 (간단). */
function cleanText(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Web Crypto SHA-256 → 앞 16 자 hex. URL hash 로 D1 PK 사용. */
export async function hashUrl(url: string): Promise<string> {
  const enc = new TextEncoder().encode(url);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type RssChannelItem = {
  title?: string | {"#text"?: string};
  link?: string | {"#text"?: string};
  description?: string | {"#text"?: string};
  pubDate?: string;
  "dc:date"?: string;
};

function getText(v: string | {"#text"?: string} | undefined): string {
  if (typeof v === "string") return v;
  return v?.["#text"] ?? "";
}

export function parseRssXml(xml: string): RssItem[] {
  const parsed = parser.parse(xml) as {
    rss?: {channel?: {item?: RssChannelItem | RssChannelItem[]}};
    feed?: {entry?: RssChannelItem | RssChannelItem[]}; // Atom 미세 호환
  };
  const channelItems = parsed.rss?.channel?.item;
  const atomEntries = parsed.feed?.entry;
  const raw = channelItems ?? atomEntries;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map<RssItem>((it) => ({
      url: cleanText(getText(it.link)),
      title: cleanText(getText(it.title)),
      summary: cleanText(getText(it.description)) || undefined,
      publishedAt: parseDate(it.pubDate ?? it["dc:date"]),
    }))
    .filter((it) => it.url && it.title);
}

/** 한 매체 RSS fetch + normalize. */
export async function fetchSource(
  source: NewsSource
): Promise<NormalizedArticle[]> {
  const res = await fetch(source.url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; trading-bot/1.0; +https://trading.jdgrid.com)",
      accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    throw new Error(`rss.${source.key}: HTTP ${res.status}`);
  }
  const xml = await res.text();
  const items = parseRssXml(xml);
  const out: NormalizedArticle[] = [];
  for (const it of items) {
    const url_hash = await hashUrl(it.url);
    const assetClasses = inferAssetClasses(
      source.defaultAssets,
      it.title,
      it.summary
    );
    out.push({
      url: it.url,
      url_hash,
      title: it.title,
      summary: it.summary ?? null,
      published_at: it.publishedAt,
      source: source.label,
      source_key: source.key,
      asset_classes: assetClasses,
    });
  }
  return out;
}

/** 전체 매체 병렬 fetch — 한 매체 실패해도 나머지 누적. */
export async function fetchAllSources(): Promise<{
  articles: NormalizedArticle[];
  errors: {source_key: NewsSourceKey; error: string}[];
}> {
  const settled = await Promise.allSettled(
    NEWS_SOURCES.map((s) => fetchSource(s))
  );
  const articles: NormalizedArticle[] = [];
  const errors: {source_key: NewsSourceKey; error: string}[] = [];
  settled.forEach((r, i) => {
    const src = NEWS_SOURCES[i];
    if (r.status === "fulfilled") {
      articles.push(...r.value);
    } else {
      errors.push({
        source_key: src.key,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return {articles, errors};
}
