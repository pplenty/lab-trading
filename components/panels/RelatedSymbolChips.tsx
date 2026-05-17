import {Link} from "@/i18n/navigation";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지 하단 — 같은 자산군의 다른 등록 종목 chip nav.
// 사용자가 표 / 검색 / 사이드바 없이 빠르게 옆 종목으로 이동.

type Props = {
  class: AssetClass;
  /** 현재 종목 — 본인은 제외. */
  currentSymbol: string;
  /** 후보 종목 — registry 의 (symbol, label) 페어. */
  siblings: Array<{symbol: string; label: string; ticker?: string}>;
};

export function RelatedSymbolChips({class: cls, currentSymbol, siblings}: Props) {
  const others = siblings.filter((s) => s.symbol !== currentSymbol);
  if (others.length === 0) return null;
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        같은 자산군의 다른 종목
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {others.map((s) => (
          <Link
            key={s.symbol}
            href={`/${cls}/${s.symbol}`}
            prefetch={false}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface/40 px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-fg hover:text-fg"
          >
            <span className="font-medium text-fg">{s.label}</span>
            {s.ticker && (
              <span className="text-fg-subtle">{s.ticker}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
