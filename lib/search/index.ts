import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import type {AssetClass} from "@/lib/types";
import {isPureChoSet, jamoChoString} from "./hangul";

// 정적 검색 인덱스 (ADR-0022).
//
// 매칭 규칙:
//   1) symbol / ticker 정확/prefix (대소문자 무시)
//   2) name / nameKo prefix / substring
//   3) **한글 초성 매칭** — query 가 순수 초성 (예: "ㅂㅌㅋ") 이면 종목명의 초성 시퀀스
//      에 대해 prefix/substring 매칭 ("ㅂㅌㅋ" → 비트코인 ㅂㅌㅋㅇ prefix).
// 정렬: 매칭 우선순위 (정확 > prefix > 초성 prefix > substring > 초성 substring)

export type SearchEntry = {
  class: AssetClass;
  symbol: string;
  ticker: string;
  name: string;
  nameKo?: string;
  /** 자산군 인덱스 페이지 — 검색 결과의 자산군 라벨 */
  classLabel: string;
};

export const searchIndex: SearchEntry[] = [
  ...cryptoRegistry.map((e) => ({
    class: "crypto" as const,
    symbol: e.symbol,
    ticker: e.symbol.toUpperCase(),
    name: e.name,
    nameKo: e.nameKo,
    classLabel: "Crypto",
  })),
  ...usRegistry.map((e) => ({
    class: "us" as const,
    symbol: e.symbol,
    ticker: e.ticker,
    name: e.name,
    nameKo: e.nameKo,
    classLabel: "US",
  })),
  ...krRegistry.map((e) => ({
    class: "kr" as const,
    symbol: e.symbol,
    ticker: e.ticker,
    name: e.name,
    nameKo: e.nameKo,
    classLabel: "KR",
  })),
];

// 초성 검색용 미리 계산된 cho 시퀀스 (nameKo 만 — 한국식 검색 의도).
// entry index 와 1:1.
const choIndex: string[] = searchIndex.map((e) =>
  e.nameKo ? jamoChoString(e.nameKo) : ""
);

type Scored = {entry: SearchEntry; score: number};

function scoreEntry(entry: SearchEntry, choSeq: string, q: string, qIsCho: boolean): number {
  if (!q) return 0;
  const lq = q.toLowerCase();

  // 초성 query — 일반 매칭 skip + 초성만 검사 (false positive 회피).
  if (qIsCho) {
    if (!choSeq) return 0;
    if (choSeq.startsWith(q)) return 550; // 초성 prefix
    if (choSeq.includes(q)) return 250; // 초성 substring
    return 0;
  }

  // 1) 정확 일치 → 가장 높음
  if (entry.symbol === lq || entry.ticker.toLowerCase() === lq) return 1000;

  // 2) symbol / ticker prefix
  if (entry.symbol.startsWith(lq)) return 800;
  if (entry.ticker.toLowerCase().startsWith(lq)) return 750;

  // 3) name prefix (단어 시작)
  const nameLower = entry.name.toLowerCase();
  if (nameLower.startsWith(lq)) return 600;
  const nameTokens = nameLower.split(/\s+/);
  if (nameTokens.some((tok) => tok.startsWith(lq))) return 500;

  // 4) nameKo prefix / substring
  if (entry.nameKo) {
    if (entry.nameKo.startsWith(q)) return 600;
    if (entry.nameKo.includes(q)) return 400;
  }

  // 5) substring fallback
  if (nameLower.includes(lq)) return 200;
  if (entry.symbol.includes(lq)) return 150;

  return 0;
}

export function searchAssets(query: string, limit: number = 8): SearchEntry[] {
  const q = query.trim();
  if (!q) return [];
  const qIsCho = isPureChoSet(q);

  const scored: Scored[] = [];
  for (let i = 0; i < searchIndex.length; i++) {
    const entry = searchIndex[i];
    const s = scoreEntry(entry, choIndex[i], q, qIsCho);
    if (s > 0) scored.push({entry, score: s});
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
