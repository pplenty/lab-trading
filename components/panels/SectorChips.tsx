import {Tag} from "lucide-react";
import {Link} from "@/i18n/navigation";
import {listSectors} from "@/lib/symbols/sectors";
import type {AssetClass} from "@/lib/types";

// 자산군 인덱스 페이지 상단 sector chip 필터.
// 클릭 시 ?sector=<name> 으로 navigation. 같은 chip 다시 클릭 시 필터 해제.

type Props = {
  class: AssetClass;
  /** 현재 선택된 sector (없으면 "all"). */
  current?: string;
};

const ASSET_PATH = {
  crypto: "/crypto",
  us: "/us",
  kr: "/kr",
} as const;

export function SectorChips({class: cls, current}: Props) {
  const sectors = listSectors(cls);
  if (sectors.length === 0) return null;
  const totalCount = sectors.reduce((s, x) => s + x.count, 0);
  const path = ASSET_PATH[cls];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-subtle">
        <Tag size={10} aria-hidden="true" />
        섹터
      </span>
      <Link
        href={path}
        scroll={false}
        aria-pressed={!current}
        className={
          "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors " +
          (!current
            ? "border-fg bg-fg text-bg"
            : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
        }
      >
        전체 {totalCount}
      </Link>
      {sectors.map(({sector, count}) => {
        const active = sector === current;
        const href = active
          ? path
          : `${path}?sector=${encodeURIComponent(sector)}`;
        return (
          <Link
            key={sector}
            href={href}
            scroll={false}
            aria-pressed={active}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors " +
              (active
                ? "border-fg bg-fg/10 text-fg"
                : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
            }
          >
            {sector}
            <span className="text-fg-subtle">·{count}</span>
          </Link>
        );
      })}
    </div>
  );
}
