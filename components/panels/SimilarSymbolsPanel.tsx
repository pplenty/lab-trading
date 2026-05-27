import {TrendingUp, TrendingDown, Activity} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {loadSimilarSymbols, type SimilarSymbol} from "@/lib/market/similar-symbols";
import {getAssetMeta} from "@/lib/symbols/registry";
import {getSector} from "@/lib/symbols/sectors";
import type {AssetClass} from "@/lib/types";

// 종목 상세 "비슷한 움직임 / 반대 움직임" panel.
// 같은 자산군 내 daily log returns pearson correlation 기반.
// 1년 windows, 6h KV cache.

type Props = {
  class: AssetClass;
  symbol: string;
  locale?: string;
};

export async function SimilarSymbolsPanel({class: cls, symbol, locale = "ko"}: Props) {
  const result = await loadSimilarSymbols(cls, symbol);
  if (result.topSimilar.length === 0 && result.topOpposite.length === 0) return null;

  return (
    <section className="mb-6 grid gap-3 lg:grid-cols-2">
      <SimilarColumn
        title="비슷한 움직임"
        Icon={TrendingUp}
        items={result.topSimilar}
        cls={cls}
        locale={locale}
        tone="up"
      />
      <SimilarColumn
        title="반대 움직임"
        Icon={TrendingDown}
        items={result.topOpposite}
        cls={cls}
        locale={locale}
        tone="down"
      />
      <p className="lg:col-span-2 text-[10px] text-fg-subtle">
        <Activity size={9} aria-hidden="true" className="mr-1 inline" />
        최근 1년 daily log returns pearson ρ · 평균 ρ{" "}
        <span className="tabular-nums">{result.meanCorrelation.toFixed(2)}</span>
        {" "}· 같은 자산군 내 N개 종목과 비교
      </p>
    </section>
  );
}

function SimilarColumn({
  title,
  Icon,
  items,
  cls,
  locale,
  tone,
}: {
  title: string;
  Icon: typeof TrendingUp;
  items: SimilarSymbol[];
  cls: AssetClass;
  locale: string;
  tone: "up" | "down";
}) {
  if (items.length === 0) return null;
  const headerColor =
    tone === "up" ? "text-[var(--color-up)]" : "text-[var(--color-down)]";

  return (
    <div className="rounded-lg border border-line bg-surface/30 p-3">
      <header className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${headerColor}`}>
        <Icon size={12} aria-hidden="true" />
        {title}
      </header>
      <ul className="flex flex-col gap-1">
        {items.map((it) => {
          const meta = getAssetMeta(cls, it.symbol);
          const sector = getSector(cls, it.symbol);
          const displayName = meta
            ? locale === "ko" && meta.nameKo
              ? meta.nameKo
              : meta.name
            : it.symbol.toUpperCase();
          return (
            <li key={it.symbol}>
              <Link
                href={`/${cls}/${it.symbol}`}
                prefetch={false}
                className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-surface"
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate font-medium text-fg">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-fg-subtle">
                    {meta?.ticker ?? it.symbol.toUpperCase()}
                  </span>
                  {sector && (
                    <span className="rounded-full border border-line bg-bg px-1 py-0.5 text-[10px] text-fg-muted">
                      {sector}
                    </span>
                  )}
                </span>
                <span
                  className={
                    "shrink-0 tabular-nums text-[11px] " +
                    (it.correlation > 0.5
                      ? "text-[var(--color-up)] font-semibold"
                      : it.correlation < -0.3
                      ? "text-[var(--color-down)] font-semibold"
                      : "text-fg-muted")
                  }
                  title={`pearson ρ = ${it.correlation.toFixed(3)}`}
                >
                  ρ {it.correlation > 0 ? "+" : ""}
                  {it.correlation.toFixed(2)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
