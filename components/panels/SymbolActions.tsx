"use client";

import {Link} from "@/i18n/navigation";
import {SymbolPicker} from "./SymbolPicker";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지 헤더 아래 액션 영역.
// 백테스트 빠른 진입 + 다른 종목으로 빠른 전환 (SymbolPicker) + 자산군 인덱스.
//
// "use client" — SymbolPicker 가 client (useRouter / localStorage hooks) 라 server tree
// 에서 직접 박을 시 RSC 경계 처리 quirk 로 500 fail (직전 회귀, 8cb742e revert).
// SymbolActions 자체를 client 로 변환해 동일 tree 안에 박는다.

type Props = {
  class: AssetClass;
  symbol: string;
  /** 현재 종목 표시명 — SymbolPicker 의 button 라벨에 사용. */
  label?: string;
};

export function SymbolActions({class: cls, symbol, label}: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Link
        href={`/backtest/new?asset=${cls}&symbol=${symbol}`}
        className="inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">⚡</span>
        <span>이 종목으로 백테스트</span>
      </Link>
      <SymbolPicker
        currentLabel={label ? `${label} · ${symbol.toUpperCase()}` : symbol.toUpperCase()}
        destination={(e) => `/${e.class}/${e.symbol}`}
      />
      <Link
        href={`/${cls}`}
        className="inline-flex items-center gap-1 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
      >
        ← 자산군 인덱스
      </Link>
    </div>
  );
}
