"use client";

import {Bitcoin, Clock, Globe, Landmark, FlaskConical, BarChart3, Star, TrendingUp, Wallet} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {Link, usePathname} from "@/i18n/navigation";
import {ChevronLeftIcon} from "@/components/icons";
import {useFavorites, parseFavoriteId, type FavoriteId} from "@/lib/favorites";
import {useRecents} from "@/lib/recents";
import {getAssetMeta} from "@/lib/symbols/registry";
import type {AssetClass} from "@/lib/types";

// 자산군 메뉴 사이드바 (ADR-0014) + 즐겨찾기 / 최근 본 종목 (ADR-0016 localStorage).
// 즐겨찾기·최근 그룹은 항목이 있을 때만 노출 (mount 후 useSyncExternalStore 로 hydration).

type Item = {
  href: string;
  labelKey: string;
  /** stub 인 경우 disabled — 클릭 비활성 + "준비 중" 라벨 */
  stub?: boolean;
};

type Group = {
  id: "crypto" | "us" | "kr" | "backtest" | "market" | "tools";
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
      {href: "/crypto/news", labelKey: "news", stub: false},
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
      {href: "/us/news", labelKey: "news", stub: false},
    ],
  },
  {
    id: "kr",
    Icon: Landmark,
    items: [
      {href: "/kr", labelKey: "quotes"},
      {href: "/kr/gainers", labelKey: "gainers"},
      {href: "/kr/losers", labelKey: "losers"},
      {href: "/kr/volume", labelKey: "volume"},
      {href: "/kr/kospi", labelKey: "kospi"},
      {href: "/kr/kosdaq", labelKey: "kosdaq"},
      {href: "/kr/news", labelKey: "news", stub: false},
    ],
  },
  {
    id: "backtest",
    Icon: FlaskConical,
    items: [
      {href: "/backtest/new", labelKey: "backtest-new"},
      {href: "/backtest/custom", labelKey: "backtest-custom"},
      {href: "/backtest/vs", labelKey: "backtest-vs"},
      {href: "/backtest/portfolio", labelKey: "backtest-portfolio"},
      {href: "/backtest/saved", labelKey: "backtest-saved"},
    ],
  },
  {
    id: "market",
    Icon: TrendingUp,
    items: [
      {href: "/market", labelKey: "market-sentiment"},
      {href: "/indices", labelKey: "indices"},
      {href: "/compare", labelKey: "compare"},
      {href: "/news", labelKey: "news-all"},
    ],
  },
  {
    id: "tools",
    Icon: Wallet,
    items: [
      {href: "/me", labelKey: "me"},
      {href: "/portfolio", labelKey: "portfolio-paper"},
      {href: "/favorites", labelKey: "favorites"},
      {href: "/alerts", labelKey: "alerts"},
      {href: "/notes", labelKey: "notes"},
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
  const locale = useLocale();
  const pathname = usePathname();
  const {favorites} = useFavorites();
  const {recents} = useRecents();

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
                ? "mb-4 flex items-center gap-2 rounded-lg border border-fg bg-surface-hover px-3 py-2 text-sm font-medium text-fg"
                : "mb-4 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

      <div className="flex flex-col gap-5 pr-1">
        {favorites.length > 0 && (
          <AssetList
            heading="즐겨찾기"
            HeadingIcon={Star}
            iconClass="fill-accent text-accent"
            items={favorites}
            count={favorites.length}
            pathname={pathname}
            locale={locale}
          />
        )}
        {recents.length > 0 && (
          <AssetList
            heading="최근 본"
            HeadingIcon={Clock}
            iconClass="text-fg-muted"
            items={recents.map((r) => `${r.class}:${r.symbol}` as FavoriteId)}
            count={recents.length}
            pathname={pathname}
            locale={locale}
          />
        )}
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

function AssetList({
  heading,
  HeadingIcon,
  iconClass,
  items,
  count,
  pathname,
  locale,
}: {
  heading: string;
  HeadingIcon: typeof Star;
  iconClass: string;
  items: FavoriteId[];
  count: number;
  pathname: string;
  locale: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-2 py-1">
        <HeadingIcon
          size={13}
          className={`shrink-0 ${iconClass}`}
          aria-hidden="true"
        />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {heading}
        </span>
        <span className="text-fg-subtle">{count}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {items.map((id) => {
          const {class: cls, symbol} = parseFavoriteId(id);
          const meta = getAssetMeta(cls as AssetClass, symbol);
          if (!meta) return null;
          const href = `/${cls}/${symbol}`;
          const active = pathname === href;
          const display =
            locale === "ko" && meta.nameKo ? meta.nameKo : meta.name;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center justify-between gap-2 rounded-md bg-surface-hover px-3 py-1.5 text-sm font-medium text-fg"
                    : "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface hover:text-fg"
                }
              >
                <span className="truncate">{display}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-subtle">
                  {cls}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
