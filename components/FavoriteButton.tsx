"use client";

import {Star} from "lucide-react";
import {useFavorites} from "@/lib/favorites";
import type {AssetClass} from "@/lib/types";

// 자산 즐겨찾기 토글 ★ 버튼.
// 종목 상세 페이지 헤더 또는 QuoteTable inline 에 배치.

type Props = {
  class: AssetClass;
  symbol: string;
  /** 라벨 (a11y / tooltip). 자산명 또는 ticker. */
  label?: string;
};

export function FavoriteButton({class: cls, symbol, label}: Props) {
  const {isFavorite, toggle} = useFavorites();
  const active = isFavorite(cls, symbol);
  const aria = active
    ? `${label ?? symbol.toUpperCase()} 즐겨찾기 해제`
    : `${label ?? symbol.toUpperCase()} 즐겨찾기에 추가`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(cls, symbol);
      }}
      aria-label={aria}
      aria-pressed={active}
      title={aria}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Star
        size={14}
        className={active ? "fill-accent text-accent" : ""}
        aria-hidden="true"
      />
    </button>
  );
}
