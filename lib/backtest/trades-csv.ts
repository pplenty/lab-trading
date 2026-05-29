import type {Trade} from "./types";
import {pairRoundTrips} from "./round-trips";

// 백테스트 거래 내역 → CSV. 화면엔 최근 20건만 보이지만 export 는 전체 round-trip.
// 스프레드시트 친화: ISO 날짜 + raw 숫자(통화 포맷 X) + 사유 컬럼.

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // 쉼표·따옴표·개행 포함 시 큰따옴표로 감싸고 내부 따옴표는 escape.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** unix sec → YYYY-MM-DD (UTC). */
function isoDate(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

const HEADER = [
  "#",
  "status",
  "buy_date",
  "buy_price",
  "sell_date",
  "sell_price",
  "pnl",
  "pnl_pct",
  "hold_days",
  "buy_reason",
  "sell_reason",
] as const;

/** 전체 round-trip 을 CSV 문자열로. 첫 줄 헤더 + round-trip 당 1줄. */
export function tradesToCsv(trades: Trade[]): string {
  const trips = pairRoundTrips(trades);
  const lines: string[] = [HEADER.join(",")];
  trips.forEach((trip, i) => {
    const row = [
      i + 1,
      trip.sell ? "closed" : "open",
      isoDate(trip.buy.t),
      trip.buy.price,
      trip.sell ? isoDate(trip.sell.t) : "",
      trip.sell ? trip.sell.price : "",
      trip.pnl ?? "",
      trip.pnlPct ?? "",
      trip.holdDays ?? "",
      trip.buy.reason ?? "",
      trip.sell?.reason ?? "",
    ];
    lines.push(row.map(csvCell).join(","));
  });
  return lines.join("\n");
}
