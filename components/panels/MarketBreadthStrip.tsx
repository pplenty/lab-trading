import type {AssetClass, Quote} from "@/lib/types";
import {Link} from "@/i18n/navigation";
import {computeMarketBreadth} from "@/lib/market/breadth";

// 자산군 인덱스 "시장 한눈에" 스트립 — 상승/하락 수 + 평균 변동 + 최고/최저 종목.
// 로드된 quotes 만으로 계산(외부 fetch 0). 공포·탐욕(심리)과 짝이 되는 객관적 시장 폭.
// a11y: 색만으로 의미 전달 X — ▲/▼ 화살표 + 부호 병기 (컨벤션 I).

type Props = {
  class: AssetClass;
  quotes: Quote[];
  nameMap: Record<string, {name: string; nameKo?: string}>;
  locale: string;
};

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function toneClass(v: number): string {
  return v > 0
    ? "text-[var(--color-up)]"
    : v < 0
    ? "text-[var(--color-down)]"
    : "text-fg-muted";
}

export function MarketBreadthStrip({class: cls, quotes, nameMap, locale}: Props) {
  const b = computeMarketBreadth(quotes);
  if (!b) return null;
  const name = (sym: string) => {
    const meta = nameMap[sym];
    if (!meta) return sym.toUpperCase();
    return (locale === "ko" ? meta.nameKo ?? meta.name : meta.name) || sym.toUpperCase();
  };

  return (
    <section
      aria-label="시장 폭 요약"
      className="mb-5 rounded-lg border border-line bg-surface/40 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 text-sm">
        {/* 좌: 종목 수 + 상승/하락/보합 + advance-decline 바 */}
        <div className="flex items-center gap-3">
          <span className="font-medium text-fg tabular-nums">{b.total}종목</span>
          <span className="flex items-center gap-2 tabular-nums">
            <span className="text-[var(--color-up)]">▲ {b.up}</span>
            <span className="text-[var(--color-down)]">▼ {b.down}</span>
            {b.flat > 0 && <span className="text-fg-subtle">— {b.flat}</span>}
          </span>
          <span
            className="hidden h-1.5 w-24 overflow-hidden rounded-full sm:block"
            style={{backgroundColor: "color-mix(in srgb, var(--color-down) 35%, transparent)"}}
            aria-hidden
          >
            <span
              className="block h-full"
              style={{
                width: `${(b.upRatio * 100).toFixed(1)}%`,
                backgroundColor: "var(--color-up)",
              }}
            />
          </span>
        </div>

        {/* 우: 평균 변동 + 최고/최저 종목 (클릭 시 상세) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-fg-subtle">
            평균{" "}
            <span className={`font-medium tabular-nums ${toneClass(b.avgChangePct)}`}>
              {fmtPct(b.avgChangePct)}
            </span>
          </span>
          {b.topGainer && (
            <Link
              href={`/${cls}/${b.topGainer.symbol}`}
              prefetch={false}
              className="text-fg-subtle transition-colors hover:text-fg"
            >
              최고{" "}
              <span className="font-medium text-fg">{name(b.topGainer.symbol)}</span>{" "}
              <span className="tabular-nums text-[var(--color-up)]">
                {fmtPct(b.topGainer.changePct)}
              </span>
            </Link>
          )}
          {b.topLoser && b.topLoser.symbol !== b.topGainer?.symbol && (
            <Link
              href={`/${cls}/${b.topLoser.symbol}`}
              prefetch={false}
              className="text-fg-subtle transition-colors hover:text-fg"
            >
              최저{" "}
              <span className="font-medium text-fg">{name(b.topLoser.symbol)}</span>{" "}
              <span className="tabular-nums text-[var(--color-down)]">
                {fmtPct(b.topLoser.changePct)}
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
