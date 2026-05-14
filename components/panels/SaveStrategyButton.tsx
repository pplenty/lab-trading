"use client";

import {useState} from "react";
import {Bookmark, Check} from "lucide-react";
import {useSavedStrategies} from "@/lib/strategies/saved";
import type {AssetClass} from "@/lib/types";

// 백테스트 폼에서 현재 (전략 + 파라미터 + 종목) 조합을 localStorage 에 저장.
// 단순 prompt() — 폼 모달 dialog 는 후속 PR 에서 design polish.

type Props = {
  strategyId: string;
  params: Record<string, number>;
  class: AssetClass;
  symbol: string;
  /** 종목 표시명 — 디폴트 저장 이름 제안에 사용. */
  defaultLabel: string;
  /** 전략 표시명 — 디폴트 저장 이름 제안에 사용. */
  strategyName: string;
};

export function SaveStrategyButton({
  strategyId,
  params,
  class: cls,
  symbol,
  defaultLabel,
  strategyName,
}: Props) {
  const {save} = useSavedStrategies();
  const [savedJustNow, setSavedJustNow] = useState(false);

  function handleClick() {
    const suggested = `${strategyName} on ${defaultLabel}`;
    const name = window.prompt("전략 이름", suggested);
    if (!name) return;
    save({
      strategyId,
      params,
      defaultClass: cls,
      defaultSymbol: symbol,
      name: name.trim() || suggested,
    });
    setSavedJustNow(true);
    window.setTimeout(() => setSavedJustNow(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {savedJustNow ? (
        <>
          <Check size={12} aria-hidden="true" />
          <span>저장됨</span>
        </>
      ) : (
        <>
          <Bookmark size={12} aria-hidden="true" />
          <span>전략 저장</span>
        </>
      )}
    </button>
  );
}
