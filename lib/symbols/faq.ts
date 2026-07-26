import type {AssetClass} from "@/lib/types";
import {strategies} from "@/lib/backtest/strategies/registry";

// 종목 상세 "자주 묻는 질문" — D1 파생 고유 Q&A 생성 (검색 진입 콘텐츠 깊이).
//
// 의도:
// - thin content 해소 — 112 종목 × 데이터 기반 고유 본문 (long-tail 검색 진입)
// - Google/Naver 구조화 데이터 (FAQPage) + AdSense 콘텐츠 깊이
// - 외부 fetch 0 — 전부 D1 candle 에서 파생. 패널은 순수 빌더 + 렌더만.
//
// NOTE: Google 은 2023 이후 FAQ rich result 를 권위 사이트(정부·의료)로 제한.
// 따라서 JSON-LD 의 1차 가치는 rich snippet 이 아니라 (1) 페이지 내 고유 본문,
// (2) Naver/기타 엔진 구조화 데이터, (3) 미래 호환. 과대 기대 금지.

export type FaqItem = {q: string; a: string};

export type SymbolFaqInput = {
  cls: AssetClass;
  displayName: string; // 비트코인 / 애플 / 삼성전자
  label: string; // BTC / AAPL / 005930
  market: string | null; // NASDAQ / KOSPI / null(crypto)
  sector: string | null; // Layer 1 / 반도체 / ...
  desc: string | null; // getSymbolDesc 한 줄 소개
  asOf: number; // 최신 봉 unix sec
  current: number | null;
  changePct: number | null; // 전일 종가 대비
  high52: number | null; // 52주 종가 최고
  low52: number | null; // 52주 종가 최저
  ret1m: number | null;
  ret3m: number | null;
  ret1y: number | null;
};

// 한글 받침 판별 → 조사 선택 (은/는, 을/를). 한글 음절이 아니면 받침 없음 취급.
function hasBatchim(s: string): boolean {
  if (!s) return false;
  const code = s.charCodeAt(s.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function eunNeun(w: string): string {
  return hasBatchim(w) ? "은" : "는";
}

function fmtPct(p: number): string {
  return `${p > 0 ? "+" : ""}${p.toFixed(2)}%`;
}

function dir(p: number): string {
  return p > 0 ? "상승" : p < 0 ? "하락" : "보합";
}

function fmtPrice(v: number, cls: AssetClass): string {
  if (cls === "us") {
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  // crypto / kr → KRW
  if (v >= 100) return `${Math.round(v).toLocaleString("ko-KR")}원`;
  if (v >= 1)
    return `${v.toLocaleString("ko-KR", {maximumFractionDigits: 2})}원`;
  // 초소액 코인 (SHIB 등) — 유효숫자 보존
  return `${v.toLocaleString("ko-KR", {maximumFractionDigits: 8})}원`;
}

function fmtDate(asOf: number): string {
  // 일봉 t = 거래일 00:00 UTC → UTC 컴포넌트가 곧 거래일 (TZ 무관 결정적)
  const d = new Date(asOf * 1000);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** D1 파생 값으로 종목 FAQ Q&A 목록 생성. 데이터 없는 항목은 생략. */
export function buildSymbolFaq(input: SymbolFaqInput): FaqItem[] {
  const {cls, displayName, label} = input;
  const items: FaqItem[] = [];
  const unitNoun = cls === "crypto" ? "코인" : "종목";

  // Q1. 현재가
  if (input.current !== null) {
    let a = `${fmtDate(input.asOf)} 종가 기준 ${fmtPrice(input.current, cls)}입니다.`;
    if (input.changePct !== null) {
      a += ` 전일 종가 대비 ${fmtPct(input.changePct)} ${dir(input.changePct)}했습니다.`;
    }
    items.push({q: `${displayName}(${label}) 현재 가격은 얼마인가요?`, a});
  }

  // Q2. 52주 고저
  if (input.high52 !== null && input.low52 !== null) {
    let a = `최근 1년 종가 기준 최고 ${fmtPrice(input.high52, cls)}, 최저 ${fmtPrice(
      input.low52,
      cls
    )}입니다.`;
    if (input.current !== null && input.high52 > 0) {
      const fromHigh = (input.current / input.high52 - 1) * 100;
      a += ` 현재가는 52주 최고가 대비 ${fmtPct(fromHigh)}로 ${
        fromHigh < 0 ? "낮은" : "높은"
      } 수준입니다.`;
    }
    items.push({q: `${displayName}의 52주 최고가·최저가는 얼마인가요?`, a});
  }

  // Q3. 최근 수익률
  const retParts: string[] = [];
  if (input.ret1m !== null) retParts.push(`1개월 ${fmtPct(input.ret1m)}`);
  if (input.ret3m !== null) retParts.push(`3개월 ${fmtPct(input.ret3m)}`);
  if (input.ret1y !== null) retParts.push(`1년 ${fmtPct(input.ret1y)}`);
  if (retParts.length > 0) {
    items.push({
      q: `${displayName}의 최근 수익률은 어떻게 되나요?`,
      a: `종가 기준 ${retParts.join(
        ", "
      )} 변동했습니다. 과거 수익률이 미래 수익을 보장하지는 않습니다.`,
    });
  }

  // Q4. 종목 소개
  {
    const meta: string[] = [];
    if (input.market) meta.push(input.market);
    if (input.sector) meta.push(`${input.sector} 섹터`);
    const parts: string[] = [];
    if (input.desc) parts.push(input.desc);
    if (meta.length > 0) parts.push(`(${meta.join(" · ")})`);
    const a =
      parts.length > 0
        ? parts.join(" ")
        : `${displayName}${eunNeun(
            displayName
          )} lab-trading에서 일봉 시세·차트·26개 보조지표·백테스트를 제공하는 ${unitNoun}입니다.`;
    items.push({q: `${displayName}${eunNeun(displayName)} 어떤 ${unitNoun}인가요?`, a});
  }

  // Q5. 백테스트
  items.push({
    q: `lab-trading에서 ${displayName} 백테스트가 가능한가요?`,
    a: `네. ${displayName} 일봉 데이터로 매수 후 보유·이동평균 교차·RSI 역추세·MACD 교차 등 ${strategies.length}가지 전략을 백테스트하고 총수익률·MDD·샤프지수·승률을 즉시 확인할 수 있습니다.`,
  });

  return items;
}

/** FAQ 항목 → schema.org FAQPage JSON-LD 문자열. */
export function faqJsonLd(items: FaqItem[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {"@type": "Answer", text: it.a},
    })),
  });
}
