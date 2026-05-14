import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import type {AssetClass} from "@/lib/types";

// 정적 검색 인덱스 (ADR-0022) — 1차 출시는 등록된 36 종목만.
// Phase 1.5 에 자산군별 top 500 + D1 LIKE fallback 으로 확장.
//
// 매칭 규칙:
//   1) symbol prefix (대소문자 무시)
//   2) ticker prefix (대소문자 무시) — KR 은 6자리 코드 그대로
//   3) name 또는 nameKo 의 substring 또는 token prefix
//   4) 한글 부분 매칭 (예: "삼성" → 삼성전자, "비트" → 비트코인)
// 정렬: 매칭 우선순위 (symbol prefix > ticker > name prefix > substring)

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

type Scored = {entry: SearchEntry; score: number};

function scoreEntry(entry: SearchEntry, q: string): number {
  if (!q) return 0;
  const lq = q.toLowerCase();

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

  const scored: Scored[] = [];
  for (const entry of searchIndex) {
    const s = scoreEntry(entry, q);
    if (s > 0) scored.push({entry, score: s});
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.entry);
}
