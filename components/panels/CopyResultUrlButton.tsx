"use client";

import {useState} from "react";
import {Check, Link2} from "lucide-react";
import type {AssetClass} from "@/lib/types";

// 백테스트 폼의 현재 (asset + symbol + strategy + 파라미터) 조합을 URL 로 만들어 clipboard 복사.
// `/backtest/new?asset=...&symbol=...&strategy=...&<param>=...` 형식 — 페이지가 자체 prefill 지원.
// 결과 공유 / 북마크 / 트위터 등에 그대로 붙여넣기.

type Props = {
  class: AssetClass;
  symbol: string;
  strategyId: string;
  params: Record<string, number>;
};

export function CopyResultUrlButton({
  class: cls,
  symbol,
  strategyId,
  params,
}: Props) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams({asset: cls, symbol, strategy: strategyId});
    for (const [k, v] of Object.entries(params)) {
      sp.set(k, String(v));
    }
    const url = `${window.location.origin}${window.location.pathname}?${sp.toString()}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // clipboard API 미허용 환경 — fallback prompt.
        window.prompt("결과 URL 복사", url);
      });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {copied ? (
        <>
          <Check size={12} aria-hidden="true" />
          <span>복사됨</span>
        </>
      ) : (
        <>
          <Link2 size={12} aria-hidden="true" />
          <span>결과 URL 복사</span>
        </>
      )}
    </button>
  );
}
