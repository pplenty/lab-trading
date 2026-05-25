"use client";

import {X} from "lucide-react";
import {useRouter} from "@/i18n/navigation";
import {SymbolPicker} from "./SymbolPicker";
import type {AssetClass} from "@/lib/types";

// /compare 페이지 인터랙티브 종목 picker — chip ✕ 제거 + 신규 추가.
// 4 종목 max.

type Token = {
  class: AssetClass;
  symbol: string;
  label: string;
  ticker: string;
  /** chip color — series 색과 동기. */
  color: string;
};

type Props = {
  tokens: Token[];
  range: string;
  maxSlots?: number;
};

const MAX_DEFAULT = 4;

function buildUrl(tokens: Array<{class: AssetClass; symbol: string}>, range: string): string {
  const syms = tokens.map((t) => `${t.class}:${t.symbol}`).join(",");
  return `/compare?symbols=${syms}&range=${range}`;
}

export function CompareSymbolBar({tokens, range, maxSlots = MAX_DEFAULT}: Props) {
  const router = useRouter();

  function remove(idx: number) {
    const next = tokens.filter((_, i) => i !== idx);
    if (next.length === 0) {
      // 모두 제거 시 default 로 복귀
      router.push(
        `/compare?symbols=crypto:btc,us:aapl,kr:005930&range=${range}`
      );
      return;
    }
    router.push(buildUrl(next, range));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tokens.map((t, i) => (
        <span
          key={`${t.class}:${t.symbol}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-1 text-xs"
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full"
            style={{background: t.color}}
          />
          <span className="font-medium text-fg">{t.label}</span>
          <span className="text-[10px] text-fg-subtle">{t.ticker}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`${t.label} 제거`}
            className="inline-flex h-4 w-4 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-surface hover:text-[var(--color-down)]"
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}

      {tokens.length < maxSlots && (
        <SymbolPicker
          currentLabel={`+ 종목 추가 (${tokens.length}/${maxSlots})`}
          destination={(entry) => {
            // 중복 방지
            const exists = tokens.some(
              (t) => t.class === entry.class && t.symbol === entry.symbol
            );
            if (exists) {
              return buildUrl(tokens, range);
            }
            return buildUrl([...tokens, entry], range);
          }}
        />
      )}
    </div>
  );
}
