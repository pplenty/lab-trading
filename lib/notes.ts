"use client";

import {useCallback, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "./storage";

// 종목별 사용자 노트 — localStorage 기반 (ADR-0016 익명 우선).
// 종목당 N개 노트 가능. 가벼운 텍스트 메모 (트레이딩 사이트 표준 기능).

const NOTES_KEY = "lab-trading-symbol-notes";

export type SymbolNote = {
  id: string;
  class: AssetClass;
  symbol: string;
  /** 메모 본문 (multi-line OK). */
  text: string;
  /** 사용자가 노트 작성 시점의 가격 — 후속 비교 컨텍스트. */
  priceAtCreate?: number;
  currency?: string;
  createdAt: string;
  updatedAt: string;
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useNotes() {
  const [raw, setRaw] = useLocalStorageString(NOTES_KEY, "[]");

  const items = useMemo<SymbolNote[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (v): v is SymbolNote =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as SymbolNote).id === "string" &&
          typeof (v as SymbolNote).symbol === "string" &&
          typeof (v as SymbolNote).text === "string"
      );
    } catch {
      return [];
    }
  }, [raw]);

  const add = useCallback(
    (input: Omit<SymbolNote, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const next: SymbolNote = {
        ...input,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      setRaw(JSON.stringify([next, ...items]));
      return next;
    },
    [items, setRaw]
  );

  const update = useCallback(
    (id: string, text: string) => {
      const next = items.map((n) =>
        n.id === id ? {...n, text, updatedAt: new Date().toISOString()} : n
      );
      setRaw(JSON.stringify(next));
    },
    [items, setRaw]
  );

  const remove = useCallback(
    (id: string) => {
      setRaw(JSON.stringify(items.filter((n) => n.id !== id)));
    },
    [items, setRaw]
  );

  /** 자산군 × 종목 별 노트 (생성 순 desc). */
  const notesFor = useCallback(
    (cls: AssetClass, symbol: string) =>
      items
        .filter((n) => n.class === cls && n.symbol === symbol)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [items]
  );

  return {items, add, update, remove, notesFor};
}
