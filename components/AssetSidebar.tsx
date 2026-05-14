"use client";

import {Bitcoin, Globe, Landmark, FlaskConical, BarChart3} from "lucide-react";
import {useTranslations} from "next-intl";
import {Link, usePathname} from "@/i18n/navigation";
import {ChevronLeftIcon} from "@/components/icons";

// 자산군 메뉴 사이드바 (ADR-0014).
// yutils 의 ToolsSidebar 가 카테고리 + 도구 N개 그리드라면, lab-trading 은 자산군 4개 × 하위 N개 트리.
// 1차 출시 활성: crypto · us · backtest. kr · news 는 stub (라벨 "준비 중", disabled).
//
// 셸 부트 단계에서는 카테고리 collapse · 검색 필터 · 즐겨찾기는 생략 (Phase 1.x 확장).

type Item = {
  href: string;
  labelKey: string;
  /** stub 인 경우 disabled — 클릭 비활성 + "준비 중" 라벨 */
  stub?: boolean;
};

type Group = {
  id: "crypto" | "us" | "kr" | "backtest";
  Icon: typeof Bitcoin;
  items: Item[];
};

const GROUPS: Group[] = [
  {
    id: "crypto",
    Icon: Bitcoin,
    items: [
      {href: "/crypto", labelKey: "quotes"},
      {href: "/crypto/gainers", labelKey: "gainers"},
      {href: "/crypto/losers", labelKey: "losers"},
      {href: "/crypto/volume", labelKey: "volume"},
      {href: "/crypto/news", labelKey: "news", stub: true},
    ],
  },
  {
    id: "us",
    Icon: Globe,
    items: [
      {href: "/us", labelKey: "quotes"},
      {href: "/us/gainers", labelKey: "gainers"},
      {href: "/us/losers", labelKey: "losers"},
      {href: "/us/volume", labelKey: "volume"},
      {href: "/us/news", labelKey: "news", stub: true},
    ],
  },
  {
    id: "kr",
    Icon: Landmark,
    items: [
      {href: "/kr/kospi", labelKey: "kospi", stub: true},
      {href: "/kr/kosdaq", labelKey: "kosdaq", stub: true},
      {href: "/kr/gainers", labelKey: "gainers", stub: true},
      {href: "/kr/losers", labelKey: "losers", stub: true},
      {href: "/kr/volume", labelKey: "volume", stub: true},
      {href: "/kr/news", labelKey: "news", stub: true},
    ],
  },
  {
    id: "backtest",
    Icon: FlaskConical,
    items: [
      {href: "/backtest/new", labelKey: "backtest-new"},
      {href: "/backtest/saved", labelKey: "backtest-saved", stub: true},
    ],
  },
];

type Props = {
  onClose?: () => void;
};

export function AssetSidebar({onClose}: Props) {
  const t = useTranslations("sidebar");
  const tItems = useTranslations("sidebar.items");
  const tGroups = useTranslations("sidebar.groups");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")}>
      <div className="mb-3 flex items-center justify-between gap-2 px-2">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {t("title")}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("collapse")}
            title={t("collapse")}
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronLeftIcon />
          </button>
        )}
      </div>

      {/* 대시보드 — 사이드바 상단 prominent 카드 */}
      {(() => {
        const dashboardActive = pathname === "/";
        return (
          <Link
            href="/"
            aria-current={dashboardActive ? "page" : undefined}
            className={
              dashboardActive
                ? "mb-6 flex items-center gap-2 rounded-lg border border-fg bg-surface-hover px-3 py-2 text-sm font-medium text-fg"
                : "mb-6 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            }
          >
            <BarChart3
              size={14}
              className="shrink-0 text-accent"
              aria-hidden="true"
            />
            <span className="truncate">{t("dashboard")}</span>
          </Link>
        );
      })()}

      <div className="flex flex-col gap-6 pr-1">
        {GROUPS.map(({id, Icon, items}) => (
          <div key={id}>
            <div className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
              <Icon
                size={13}
                className="shrink-0 text-fg-muted"
                aria-hidden="true"
              />
              <span className="flex-1">{tGroups(id)}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href;
                const baseLabel = tItems(item.labelKey);
                if (item.stub) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title={t("comingSoonLabel")}
                        className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm text-fg-subtle"
                      >
                        <span className="truncate">{baseLabel}</span>
                        <span className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-fg-subtle">
                          {t("comingSoonLabel")}
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "flex items-center gap-2 rounded-md bg-surface-hover px-3 py-1.5 text-sm font-medium text-fg"
                          : "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                      }
                    >
                      <span className="truncate">{baseLabel}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
