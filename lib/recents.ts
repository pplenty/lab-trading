"use client";

import {useCallback, useEffect, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "./storage";
import {parseFavoriteId, toFavoriteId, type FavoriteId} from "./favorites";

// 최근 본 종목 — LRU max N. 종목 상세 페이지 진입 시 useEffect 로 자동 트래킹.
// localStorage `lab-trading-recents` — JSON array of "class:symbol", 최신이 앞.

const RECENTS_KEY = "lab-trading-recents";
const MAX_RECENTS = 8;

export function useRecents() {
  const [raw, setRaw] = useLocalStorageString(RECENTS_KEY, "[]");

  const recents = useMemo<Array<{class: AssetClass; symbol: string}>>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((v): v is FavoriteId => typeof v === "string" && v.includes(":"))
        .map(parseFavoriteId);
    } catch {
      return [];
    }
  }, [raw]);

  const add = useCallback(
    (cls: AssetClass, symbol: string) => {
      const id = toFavoriteId(cls, symbol);
      try {
        const arr = JSON.parse(raw);
        const prev: string[] = Array.isArray(arr)
          ? arr.filter((v) => typeof v === "string")
          : [];
        const next = [id, ...prev.filter((v) => v !== id)].slice(0, MAX_RECENTS);
        setRaw(JSON.stringify(next));
      } catch {
        setRaw(JSON.stringify([id]));
      }
    },
    [raw, setRaw]
  );

  return {recents, add};
}

/** 종목 상세 페이지에서 useEffect 로 호출 — 페이지 로드 시 자동 트래킹. */
export function useTrackRecent(cls: AssetClass, symbol: string) {
  const {add} = useRecents();
  useEffect(() => {
    add(cls, symbol);
  }, [cls, symbol, add]);
}
