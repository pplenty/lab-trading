"use client";

import {useState} from "react";
import {Bookmark, Trash2} from "lucide-react";
import {useLocale} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useSavedStrategies, type SavedStrategy} from "@/lib/strategies/saved";
import {getStrategy} from "@/lib/backtest/strategies/registry";
import {getAssetMeta} from "@/lib/symbols/registry";

// 사용자 저장 전략 카드 그리드 — client (localStorage 의존).
// 카드 클릭 → /backtest/new?asset=...&symbol=...&strategy=...&<param>=... URL prefill.

function buildBacktestHref(s: SavedStrategy): string {
  const params = new URLSearchParams({
    asset: s.defaultClass,
    symbol: s.defaultSymbol,
    strategy: s.strategyId,
  });
  for (const [k, v] of Object.entries(s.params)) {
    params.set(k, String(v));
  }
  return `/backtest/new?${params.toString()}`;
}

export function SavedStrategiesPanel() {
  const {items, remove} = useSavedStrategies();
  const locale = useLocale();
  const [hydrated, setHydrated] = useState(false);

  // useSyncExternalStore 가 hydration mismatch 회피하지만, 초기 렌더는 빈 배열.
  // 빈 상태 메시지 잠깐 깜빡임 회피용 mount 플래그.
  if (typeof window !== "undefined" && !hydrated) {
    setTimeout(() => setHydrated(true), 0);
  }

  if (items.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/40 p-8 text-center">
        <Bookmark
          size={28}
          aria-hidden="true"
          className="mx-auto mb-3 text-fg-subtle"
        />
        <p className="text-sm font-medium text-fg">아직 저장된 전략이 없습니다</p>
        <p className="mt-2 text-xs text-fg-muted">
          백테스트 작업장에서 전략 + 파라미터를 조정하고 "전략 저장" 버튼을 눌러보세요.
        </p>
        <Link
          href="/backtest/new"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
        >
          새 백테스트 시작 →
        </Link>
      </section>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const meta = getStrategy(s.strategyId);
        const asset = getAssetMeta(s.defaultClass, s.defaultSymbol);
        const symbolLabel = asset
          ? locale === "ko" && asset.nameKo
            ? asset.nameKo
            : asset.name
          : s.defaultSymbol.toUpperCase();
        const paramKeys = Object.keys(s.params);
        return (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-4 transition-colors hover:border-fg"
          >
            <Link
              href={buildBacktestHref(s)}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-fg">
                  {s.name}
                </span>
                <span className="rounded-full border border-line bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-fg-subtle">
                  {s.defaultClass}
                </span>
              </div>
              <p className="text-xs text-fg-muted">
                {meta?.name ?? s.strategyId} · {symbolLabel}{" "}
                <span className="text-fg-subtle">
                  ({asset?.ticker ?? s.defaultSymbol.toUpperCase()})
                </span>
              </p>
              {paramKeys.length > 0 && (
                <p className="text-[11px] text-fg-subtle">
                  {paramKeys
                    .map((k) => `${k}=${s.params[k]}`)
                    .join(" · ")}
                </p>
              )}
              <p className="mt-1 text-[10px] text-fg-subtle">
                저장: {new Date(s.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`"${s.name}" 전략을 삭제할까요?`)) {
                  remove(s.id);
                }
              }}
              className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-fg-subtle transition-colors hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`${s.name} 삭제`}
            >
              <Trash2 size={11} aria-hidden="true" />
              삭제
            </button>
          </li>
        );
      })}
    </ul>
  );
}
