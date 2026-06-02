import {getSymbolDesc} from "@/lib/symbols/descriptions";

// 종목 한 줄 소개 블록 — 종목 상세 페이지 상단의 고유 콘텐츠(thin content 회피 + SEO).
// 설명이 없는 종목은 미표시. 추가 클라이언트 JS 0.
export function SymbolIntro({symbol}: {symbol: string}) {
  const desc = getSymbolDesc(symbol);
  if (!desc) return null;
  return (
    <section className="mb-6 rounded-lg border border-line bg-surface/30 p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        종목 소개
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{desc}</p>
    </section>
  );
}
