import type {AssetClass, RankingKind} from "@/lib/types";

// 랭킹 페이지(상승률/하락률/거래량 × 3자산군 = 9 라우트) 상단 데이터 파생 요약.
// RankingPage 가 보유한 top-N 정렬 quotes 만으로 1위 종목 + 상위 평균을 프로즈로 생성.
// 검색 진입(CLAUDE.md #1) — h1 + 테이블만이던 thin 랭킹 페이지에 고유 본문 추가.

// 한글 받침 → 조사 선택. 이름 뒤 괄호/영문/숫자는 건너뛰고 마지막 한글 음절로 판단
// (예: "비트코인(BTC)" → "인" → 받침 ㄴ).
function lastJongseong(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const code = s.charCodeAt(i);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
    if (code >= 0x30 && code <= 0x39) return 0; // 숫자 → 받침 없음 취급(간이)
  }
  return 0;
}

/** 주격 조사 이/가. */
function iga(word: string): string {
  return lastJongseong(word) !== 0 ? "이" : "가";
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

type RankQuote = {symbol: string; changePct24h: number};

export type RankingSummaryInput = {
  cls: AssetClass;
  kind: RankingKind;
  /** RankingPage 가 보유한 top-N 정렬 quotes. */
  quotes: RankQuote[];
  /** symbol → 표시명 resolver (nameMap + locale). */
  displayName: (symbol: string) => string;
  /** 자산군 라벨 — "코인" / "해외주식" / "국내주식". */
  assetLabel: string;
  /** "2026년 6월 14일" 형식. */
  dateStr: string;
  /** 상위 평균 계산 대상 종목 수 (기본 5). */
  topN?: number;
};

/** 랭킹 페이지 데이터 파생 요약 문장. quotes 가 비면 null. */
export function buildRankingSummary(input: RankingSummaryInput): string | null {
  const {cls, kind, quotes, displayName, assetLabel, dateStr} = input;
  void cls;
  if (quotes.length === 0) return null;

  const leader = quotes[0];
  const name = displayName(leader.symbol);
  const head = `${dateStr} 기준 ${assetLabel}`;

  if (kind === "volume") {
    return `${head} 거래량 상위 종목입니다. ${name}${iga(
      name
    )} 가장 활발하게 거래됐으며, 거래대금 순으로 상위 ${quotes.length}종목을 보여줍니다.`;
  }

  const k = Math.min(input.topN ?? 5, quotes.length);
  const top = quotes.slice(0, k);
  const avg = top.reduce((s, q) => s + q.changePct24h, 0) / top.length;

  if (kind === "gainers") {
    return `${head} 상승률 상위 종목입니다. ${name}${iga(name)} ${fmtPct(
      leader.changePct24h
    )}로 가장 많이 올랐고, 상위 ${k}종목은 평균 ${fmtPct(avg)} 상승했습니다.`;
  }
  // losers
  return `${head} 하락률 상위 종목입니다. ${name}${iga(name)} ${fmtPct(
    leader.changePct24h
  )}로 가장 많이 내렸고, 상위 ${k}종목은 평균 ${fmtPct(avg)} 하락했습니다.`;
}
