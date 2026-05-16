import {getTranslations} from "next-intl/server";
import type {Quote} from "@/lib/types";
import {isQuoteFromD1} from "@/lib/data/quotes";

// 종목 상세 / 카드 상단에 quote 출처가 D1 fallback 일 때만 노출되는 작은 라벨.
// 사용자에게 "라이브 가격이 아니다" 를 분명히 알린다 (투명성).

type Props = {
  quote: Quote | null | undefined;
  /** 위치별 톤 — inline (가격 옆) / banner (페이지 상단 박스) */
  variant?: "inline" | "banner";
};

export async function D1FallbackBadge({quote, variant = "inline"}: Props) {
  if (!isQuoteFromD1(quote)) return null;
  const t = await getTranslations("meta");

  if (variant === "banner") {
    return (
      <div
        role="status"
        className="mb-4 rounded-md border border-line bg-surface/60 px-3 py-2 text-[11px] text-fg-muted"
      >
        ⚠️ {t("d1FallbackBadge")} — {t("d1FallbackNote")}
      </div>
    );
  }

  return (
    <span
      title={t("d1FallbackNote")}
      className="inline-flex items-center gap-1 rounded-sm border border-line/60 bg-surface/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-fg-subtle"
    >
      {t("d1FallbackBadge")}
    </span>
  );
}
