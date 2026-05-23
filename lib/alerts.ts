"use client";

import {useCallback, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "./storage";

// 가격 알림 — localStorage 기반 (ADR-0001 매매 X 정신 + ADR-0016 익명 우선).
// 1차 MVP: 가격 조건 (>=, <=) — RSI / MACD 같은 indicator 조건은 추후.
// 도달 시 — 종목 상세 / 대시보드 진입 시 client check + banner 노출.
// server-side push 없음 (1차).

const ALERTS_KEY = "lab-trading-price-alerts";

export type AlertOp = "gte" | "lte";

export type PriceAlert = {
  /** uuid-ish — Date.now().toString(36) + random base36. */
  id: string;
  class: AssetClass;
  symbol: string;
  /** 사용자 표시 라벨 (종목명 또는 사용자 정의). */
  label: string;
  /** "가격 ≥ X" / "가격 ≤ X". */
  op: AlertOp;
  /** 조건 가격 (자산군 default currency 단위). */
  price: number;
  createdAt: string;
  /** 마지막 도달 시점. null = 아직 미도달. */
  triggeredAt: string | null;
  /** 사용자가 확인 후 자동 비활성 — true 면 banner 숨김 + check skip. */
  acknowledged: boolean;
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useAlerts() {
  const [raw, setRaw] = useLocalStorageString(ALERTS_KEY, "[]");

  const items = useMemo<PriceAlert[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (v): v is PriceAlert =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as PriceAlert).id === "string" &&
          typeof (v as PriceAlert).symbol === "string" &&
          typeof (v as PriceAlert).price === "number"
      );
    } catch {
      return [];
    }
  }, [raw]);

  const add = useCallback(
    (input: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt" | "acknowledged">) => {
      const now = new Date().toISOString();
      const next: PriceAlert = {
        ...input,
        id: newId(),
        createdAt: now,
        triggeredAt: null,
        acknowledged: false,
      };
      setRaw(JSON.stringify([next, ...items]));
      return next;
    },
    [items, setRaw]
  );

  const remove = useCallback(
    (id: string) => {
      setRaw(JSON.stringify(items.filter((a) => a.id !== id)));
    },
    [items, setRaw]
  );

  const acknowledge = useCallback(
    (id: string) => {
      const next = items.map((a) =>
        a.id === id ? {...a, acknowledged: true} : a
      );
      setRaw(JSON.stringify(next));
    },
    [items, setRaw]
  );

  /** 현재 가격이 조건 충족 → triggeredAt 기록 (이미 확인 전이면 skip). */
  const checkAndTrigger = useCallback(
    (cls: AssetClass, symbol: string, currentPrice: number): PriceAlert[] => {
      const matching = items.filter(
        (a) =>
          a.class === cls &&
          a.symbol === symbol &&
          !a.acknowledged &&
          ((a.op === "gte" && currentPrice >= a.price) ||
            (a.op === "lte" && currentPrice <= a.price))
      );
      if (matching.length === 0) return [];
      const now = new Date().toISOString();
      const next = items.map((a) => {
        const hit = matching.find((m) => m.id === a.id);
        return hit ? {...a, triggeredAt: a.triggeredAt ?? now} : a;
      });
      setRaw(JSON.stringify(next));
      return matching.map((m) => ({...m, triggeredAt: m.triggeredAt ?? now}));
    },
    [items, setRaw]
  );

  /** 자산군 × 종목 별 active (acknowledged X) 알림 — 종목 상세 UI 노출용. */
  const activeFor = useCallback(
    (cls: AssetClass, symbol: string) =>
      items.filter(
        (a) => a.class === cls && a.symbol === symbol && !a.acknowledged
      ),
    [items]
  );

  return {items, add, remove, acknowledge, checkAndTrigger, activeFor};
}
