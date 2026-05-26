"use client";

import {useCallback, useMemo} from "react";
import {useLocalStorageString} from "./storage";

// 가상 포트폴리오 일별 snapshot — 하루 1 row.
// localStorage 만. 365일까지 cap. /portfolio 페이지 진입 시 quotes load 후 자동 record.

const KEY = "lab-trading-portfolio-snapshots";
const MAX_DAYS = 365;

export type PortfolioSnapshot = {
  /** YYYY-MM-DD (UTC) — dedup key. */
  day: string;
  /** unix sec 기록 시각. */
  ts: number;
  /** 통화별 total 평가액 (holdings × current price). */
  valueByCurrency: Record<string, number>;
  /** 통화별 확정 PnL 누적. */
  realizedByCurrency: Record<string, number>;
  /** 보유 종목 수. */
  holdingCount: number;
};

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function useSnapshots() {
  const [raw, setRaw] = useLocalStorageString(KEY, "[]");

  const snapshots = useMemo<PortfolioSnapshot[]>(() => {
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (v): v is PortfolioSnapshot =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as PortfolioSnapshot).day === "string" &&
          typeof (v as PortfolioSnapshot).valueByCurrency === "object"
      );
    } catch {
      return [];
    }
  }, [raw]);

  /** 오늘 날짜로 1개 기록 — 같은 day 이미 있으면 덮어쓰기 (intraday 갱신). */
  const record = useCallback(
    (input: Omit<PortfolioSnapshot, "day" | "ts">) => {
      const day = todayKey();
      const next: PortfolioSnapshot = {
        ...input,
        day,
        ts: Math.floor(Date.now() / 1000),
      };
      // 빈 데이터는 기록 X (holdings 0 + realized 0)
      const hasContent =
        next.holdingCount > 0 ||
        Object.values(next.realizedByCurrency).some((v) => v !== 0) ||
        Object.values(next.valueByCurrency).some((v) => v !== 0);
      if (!hasContent) return;

      const without = snapshots.filter((s) => s.day !== day);
      const list = [...without, next]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-MAX_DAYS);
      setRaw(JSON.stringify(list));
    },
    [snapshots, setRaw]
  );

  const clear = useCallback(() => {
    setRaw("[]");
  }, [setRaw]);

  return {snapshots, record, clear};
}
