import type {AssetClass} from "@/lib/types";
import {getSector, getSameSector} from "@/lib/symbols/sectors";
import {loadQuotesList} from "@/lib/data/quotes";
import {computeSectorPerformance} from "@/lib/market/sector-performance";

// 종목 상세 "섹터 대비 성과" — 이 종목 24h 변동 vs 같은 섹터 peer 평균(상대강도).
// 같은 섹터 quotes 1회 배치 D1 read → 평균·순위·격차. SimilarSymbolsPanel(상관계수)과 별개.
// a11y: 색만으로 의미 전달 X — ▲/▼ + 부호 + "상회/하회" 텍스트 병기.

type Props = {
  class: AssetClass;
  symbol: string;
  displayName: string;
};

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export async function SectorPerformancePanel({
  class: cls,
  symbol,
  displayName,
}: Props) {
  const sector = getSector(cls, symbol);
  if (!sector) return null;
  const peers = getSameSector(cls, symbol); // 자기 제외
  if (peers.length === 0) return null; // 섹터 단독 → 비교 불가

  let quotes;
  try {
    quotes = await loadQuotesList({asset: cls, symbols: [symbol, ...peers]});
  } catch {
    return null;
  }
  const perf = computeSectorPerformance({
    sector,
    selfSymbol: symbol,
    quotes: quotes.map((q) => ({
      symbol: q.symbol,
      changePct24h: q.changePct24h,
    })),
  });
  if (!perf) return null;

  // 격차 0.05%p 이내는 "평균" 취급(노이즈).
  const tone: "up" | "down" | "neutral" =
    perf.deltaPp > 0.05 ? "up" : perf.deltaPp < -0.05 ? "down" : "neutral";
  const verdict =
    tone === "up" ? "섹터 상회" : tone === "down" ? "섹터 하회" : "섹터 평균";
  const arrow = tone === "up" ? "▲" : tone === "down" ? "▼" : "—";
  const toneClass =
    tone === "up"
      ? "text-[var(--color-up)]"
      : tone === "down"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";

  return (
    <section className="mt-6 mb-6" aria-label="섹터 대비 성과">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          섹터 대비 성과
        </h2>
      </header>
      <div className="rounded-lg border border-line bg-surface/30 px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <span className="text-sm text-fg-muted">
            <span className="font-medium text-fg">{sector}</span> 섹터{" "}
            {perf.count}종목 중{" "}
            <span className="font-medium text-fg tabular-nums">
              {perf.rank}위
            </span>
          </span>
          <span
            className={`flex items-baseline gap-1 text-sm font-semibold tabular-nums ${toneClass}`}
          >
            <span aria-hidden>{arrow}</span>
            <span>
              섹터 {fmtPct(perf.deltaPp)}p {verdict}
            </span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-subtle">
          <span>
            {displayName}{" "}
            <span
              className={`font-medium tabular-nums ${
                perf.selfPct > 0
                  ? "text-[var(--color-up)]"
                  : perf.selfPct < 0
                  ? "text-[var(--color-down)]"
                  : "text-fg-muted"
              }`}
            >
              {fmtPct(perf.selfPct)}
            </span>
          </span>
          <span>
            섹터 평균{" "}
            <span
              className={`font-medium tabular-nums ${
                perf.sectorAvgPct > 0
                  ? "text-[var(--color-up)]"
                  : perf.sectorAvgPct < 0
                  ? "text-[var(--color-down)]"
                  : "text-fg-muted"
              }`}
            >
              {fmtPct(perf.sectorAvgPct)}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
