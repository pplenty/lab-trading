"use client";

import {useEffect, useState} from "react";
import {BellRing, X} from "lucide-react";
import {useAlerts, type PriceAlert} from "@/lib/alerts";
import type {AssetClass} from "@/lib/types";

// 종목 상세 페이지의 도달 알림 banner — 종목 페이지 진입 시 현재가 vs 알림 조건 비교.
// hit 시 client-side state 변경 + banner 노출. 사용자가 확인 → acknowledge → 숨김.

type Props = {
  class: AssetClass;
  symbol: string;
  currentPrice: number;
  currency: string;
};

export function AlertNotice({class: cls, symbol, currentPrice, currency}: Props) {
  const {checkAndTrigger, acknowledge} = useAlerts();
  const [hit, setHit] = useState<PriceAlert[]>([]);

  useEffect(() => {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return;
    const triggered = checkAndTrigger(cls, symbol, currentPrice);
    if (triggered.length > 0) setHit(triggered);
  }, [cls, symbol, currentPrice, checkAndTrigger]);

  if (hit.length === 0) return null;

  const fmt = (n: number) =>
    currency === "KRW"
      ? `₩${n.toLocaleString("ko-KR")}`
      : `${currency === "USD" ? "$" : ""}${n.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}`;

  function dismiss(id: string) {
    acknowledge(id);
    setHit((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <section
      role="alert"
      className="mb-6 rounded-lg border border-[var(--color-up)]/40 bg-[var(--color-up)]/10 p-4"
    >
      <div className="flex items-start gap-3">
        <BellRing
          size={18}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-up)]"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-fg">
            가격 알림 조건 도달
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {hit.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 text-xs text-fg-muted"
              >
                <span>
                  {a.op === "gte" ? "≥" : "≤"} {fmt(a.price)} ·{" "}
                  <span className="text-fg">현재 {fmt(currentPrice)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => dismiss(a.id)}
                  aria-label="알림 확인"
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
                >
                  <X size={11} aria-hidden="true" />
                  확인
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
