"use client";

import {useCallback, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "@/lib/storage";

// 사용자 저장 전략 — localStorage `lab-trading-saved-strategies` JSON array.
// ADR-0020 SavedStrategy 인터페이스. id 는 timestamp + random base36.

const SAVED_STRATEGIES_KEY = "lab-trading-saved-strategies";

export type SavedStrategy = {
  id: string;
  strategyId: string;
  name: string;
  params: Record<string, number>;
  defaultClass: AssetClass;
  defaultSymbol: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useSavedStrategies() {
  const [raw, setRaw] = useLocalStorageString(SAVED_STRATEGIES_KEY, "[]");

  const items = useMemo<SavedStrategy[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (v): v is SavedStrategy =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as SavedStrategy).id === "string" &&
          typeof (v as SavedStrategy).strategyId === "string"
      );
    } catch {
      return [];
    }
  }, [raw]);

  const save = useCallback(
    (input: Omit<SavedStrategy, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const next: SavedStrategy = {
        ...input,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      const existing = items;
      setRaw(JSON.stringify([next, ...existing]));
      return next;
    },
    [items, setRaw]
  );

  const remove = useCallback(
    (id: string) => {
      setRaw(JSON.stringify(items.filter((s) => s.id !== id)));
    },
    [items, setRaw]
  );

  const rename = useCallback(
    (id: string, name: string) => {
      const next = items.map((s) =>
        s.id === id ? {...s, name, updatedAt: new Date().toISOString()} : s
      );
      setRaw(JSON.stringify(next));
    },
    [items, setRaw]
  );

  return {items, save, remove, rename};
}
