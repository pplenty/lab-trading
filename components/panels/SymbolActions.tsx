import {Link} from "@/i18n/navigation";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지 헤더 아래 액션 영역.
// 백테스트 빠른 진입 + (Phase 후속) 즐겨찾기 / 알림.

type Props = {
  class: AssetClass;
  symbol: string;
};

export function SymbolActions({class: cls, symbol}: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Link
        href={`/backtest/new?asset=${cls}&symbol=${symbol}`}
        className="inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">⚡</span>
        <span>이 종목으로 백테스트</span>
      </Link>
      <Link
        href={`/${cls}`}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
      >
        ← 자산군 인덱스
      </Link>
    </div>
  );
}
