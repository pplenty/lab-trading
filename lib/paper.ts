"use client";

import {useCallback, useMemo} from "react";
import type {AssetClass} from "@/lib/types";
import {useLocalStorageString} from "./storage";

// 가상 포트폴리오 (paper trading) — localStorage 기반.
// 실제 매매 X. 사용자가 "이 가격에 산다고 가정하면" 시나리오 검증.
//
// Position 계산:
//   - units 가 음수 → short 가정 (1차 미지원, 매수 후 매도까지만)
//   - avgPrice = weighted average of all buy fills (sell 은 보유 unit 감소)
//   - realized PnL = sell.price - avgPrice (sell 시점)
//   - unrealized PnL = (현재가 - avgPrice) × current units
//
// 통화 정책: KRW / USD 혼재 OK. 종목별 currency 저장. 총 자산은 KRW base 환산 X (1차).

const TRADES_KEY = "lab-trading-paper-trades";

export type PaperTrade = {
  id: string;
  class: AssetClass;
  symbol: string;
  /** 표시명 (e.g. "비트코인", "Apple Inc."). */
  label: string;
  side: "buy" | "sell";
  /** 단위 수 (소수점 OK — 코인 등). */
  units: number;
  /** 체결가 (per unit, 종목 currency). */
  price: number;
  /** 종목 currency — "KRW" / "USD". */
  currency: string;
  /** 사용자 메모. */
  notes?: string;
  createdAt: string;
};

export type PaperPosition = {
  class: AssetClass;
  symbol: string;
  label: string;
  currency: string;
  /** 현재 보유 units (>0 만 표시). */
  units: number;
  /** 가중 평균 매입가. */
  avgPrice: number;
  /** 누적 buy 거래 수 + 누적 sell 거래 수. */
  buyCount: number;
  sellCount: number;
  /** 확정 PnL (모든 매도 거래의 PnL 합산). */
  realizedPnl: number;
  /** 첫 매수 시각 — list 정렬에 사용. */
  openedAt: string;
};

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * trades 시계열을 reduce 해서 symbol 별 position 계산.
 * - buy: avgPrice 갱신 (units 가중평균), units += units
 * - sell: realized PnL += (price - avgPrice) × min(sellUnits, units), units -= sellUnits (floor 0)
 */
export function computePositions(trades: PaperTrade[]): PaperPosition[] {
  // 시간순 정렬
  const sorted = [...trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const map = new Map<string, PaperPosition>();
  for (const t of sorted) {
    const key = `${t.class}:${t.symbol}`;
    const existing = map.get(key);
    if (t.side === "buy") {
      if (!existing) {
        map.set(key, {
          class: t.class,
          symbol: t.symbol,
          label: t.label,
          currency: t.currency,
          units: t.units,
          avgPrice: t.price,
          buyCount: 1,
          sellCount: 0,
          realizedPnl: 0,
          openedAt: t.createdAt,
        });
      } else {
        const totalCost = existing.avgPrice * existing.units + t.price * t.units;
        const newUnits = existing.units + t.units;
        existing.avgPrice = newUnits > 0 ? totalCost / newUnits : 0;
        existing.units = newUnits;
        existing.buyCount++;
        // 첫 buy 시각 유지
        if (existing.units <= 0) {
          // 재 진입 — openedAt 갱신
          existing.openedAt = t.createdAt;
        }
      }
    } else {
      // sell
      if (!existing || existing.units <= 0) continue; // 보유 없는 sell 무시
      const sellUnits = Math.min(t.units, existing.units);
      existing.realizedPnl += (t.price - existing.avgPrice) * sellUnits;
      existing.units -= sellUnits;
      existing.sellCount++;
      if (existing.units <= 1e-9) {
        existing.units = 0;
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
  );
}

export function useTrades() {
  const [raw, setRaw] = useLocalStorageString(TRADES_KEY, "[]");

  const items = useMemo<PaperTrade[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (v): v is PaperTrade =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as PaperTrade).id === "string" &&
          typeof (v as PaperTrade).symbol === "string" &&
          typeof (v as PaperTrade).units === "number" &&
          typeof (v as PaperTrade).price === "number"
      );
    } catch {
      return [];
    }
  }, [raw]);

  const positions = useMemo(() => computePositions(items), [items]);

  const positionFor = useCallback(
    (cls: AssetClass, symbol: string): PaperPosition | null => {
      return (
        positions.find((p) => p.class === cls && p.symbol === symbol) ?? null
      );
    },
    [positions]
  );

  const add = useCallback(
    (input: Omit<PaperTrade, "id" | "createdAt">) => {
      const next: PaperTrade = {
        ...input,
        id: newId(),
        createdAt: new Date().toISOString(),
      };
      setRaw(JSON.stringify([next, ...items]));
      return next;
    },
    [items, setRaw]
  );

  const remove = useCallback(
    (id: string) => {
      setRaw(JSON.stringify(items.filter((t) => t.id !== id)));
    },
    [items, setRaw]
  );

  const tradesFor = useCallback(
    (cls: AssetClass, symbol: string): PaperTrade[] =>
      items
        .filter((t) => t.class === cls && t.symbol === symbol)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [items]
  );

  return {items, positions, positionFor, add, remove, tradesFor};
}
