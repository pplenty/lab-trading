"use client";

import {useTrackRecent} from "@/lib/recents";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지에서 mount 시 1회 recents 큐에 push.
// 페이지 (RSC) 가 client 컴포넌트로 트래킹 — 별도 효과 없는 렌더리스 컴포넌트.

export function RecentTracker({
  class: cls,
  symbol,
}: {
  class: AssetClass;
  symbol: string;
}) {
  useTrackRecent(cls, symbol);
  return null;
}
