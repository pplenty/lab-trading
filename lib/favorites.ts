"use client";

import {useCallback, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "./storage";

// 자산 즐겨찾기 — localStorage `lab-trading-favorites` 에 JSON array of "class:symbol".
// useSyncExternalStore 기반 (same-tab + cross-tab 동기).
// ADR-0016 정합 — 1차 출시는 계정 없이 localStorage 단독.

const FAVORITES_KEY = "lab-trading-favorites";

export type FavoriteId = `${AssetClass}:${string}`;

export function toFavoriteId(cls: AssetClass, symbol: string): FavoriteId {
  return `${cls}:${symbol}` as FavoriteId;
}

export function parseFavoriteId(
  id: FavoriteId
): {class: AssetClass; symbol: string} {
  const [cls, ...rest] = id.split(":");
  return {class: cls as AssetClass, symbol: rest.join(":")};
}

export function useFavorites() {
  const [raw, setRaw] = useLocalStorageString(FAVORITES_KEY, "[]");

  const favorites = useMemo<FavoriteId[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((v): v is FavoriteId => typeof v === "string" && v.includes(":"));
    } catch {
      return [];
    }
  }, [raw]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const isFavorite = useCallback(
    (cls: AssetClass, symbol: string) =>
      favoriteSet.has(toFavoriteId(cls, symbol)),
    [favoriteSet]
  );

  const toggle = useCallback(
    (cls: AssetClass, symbol: string) => {
      const id = toFavoriteId(cls, symbol);
      const next = favoriteSet.has(id)
        ? favorites.filter((f) => f !== id)
        : [...favorites, id];
      setRaw(JSON.stringify(next));
    },
    [favorites, favoriteSet, setRaw]
  );

  return {favorites, isFavorite, toggle};
}
