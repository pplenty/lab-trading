import {Tag} from "lucide-react";

// 종목 상세 헤더의 sector badge — 작은 chip.

export function SectorBadge({sector}: {sector: string}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-0.5 text-[10px] text-fg-muted">
      <Tag size={8} aria-hidden="true" className="opacity-60" />
      {sector}
    </span>
  );
}
