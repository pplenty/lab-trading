import {Link} from "@/i18n/navigation";
import {Tag} from "lucide-react";
import {getSameSector, getSector} from "@/lib/symbols/sectors";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지 하단 — sector 우선 + 기타 종목 chip nav.
// sector 가 있으면 "같은 섹터" 그룹 먼저, 나머지는 "그 외" 그룹.

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

  const sector = getSector(cls, currentSymbol);
  const sameSectorSet = new Set(getSameSector(cls, currentSymbol));
  const sameSector = others.filter((s) => sameSectorSet.has(s.symbol));
  const otherSector = others.filter((s) => !sameSectorSet.has(s.symbol));

  return (
    <section className="mb-6 flex flex-col gap-3">
      {sector && sameSector.length > 0 && (
        <div>
          <h3 className="mb-2 inline-flex items-baseline gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            <Tag size={10} aria-hidden="true" className="text-fg-muted" />
            같은 섹터 ·{" "}
            <span className="text-fg-muted normal-case tracking-normal">
              {sector}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {sameSector.map((s) => (
              <Chip key={s.symbol} cls={cls} {...s} accent />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {sector && sameSector.length > 0
            ? "그 외 같은 자산군 종목"
            : "같은 자산군의 다른 종목"}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {otherSector.map((s) => (
            <Chip key={s.symbol} cls={cls} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({
  cls,
  symbol,
  label,
  ticker,
  accent,
}: {
  cls: AssetClass;
  symbol: string;
  label: string;
  ticker?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={`/${cls}/${symbol}`}
      prefetch={false}
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:border-fg hover:text-fg " +
        (accent
          ? "border-line bg-surface text-fg"
          : "border-line bg-surface/40 text-fg-muted")
      }
    >
      <span className="font-medium">{label}</span>
      {ticker && <span className="text-fg-subtle">{ticker}</span>}
    </Link>
  );
}
