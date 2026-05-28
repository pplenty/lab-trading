"use client";

import {useEffect, useState} from "react";
import {X, Search, FlaskConical, Wallet, ArrowLeftRight} from "lucide-react";
import {Link} from "@/i18n/navigation";

// 첫 진입 안내 배너 — 신규 사용자에게 핵심 기능 4가지 소개.
// localStorage 로 1회 노출 (닫으면 다시 안 봄). 완전 독립 (회귀 0).

const SEEN_KEY = "lab-trading-onboarding-seen";

const ITEMS = [
  {
    Icon: Search,
    title: "종목 검색",
    desc: "비트코인 · AAPL · 005930 · 초성 (ㅂㅌㅋ)",
    href: "/search",
  },
  {
    Icon: FlaskConical,
    title: "백테스트",
    desc: "8 전략 + 커스텀 조건으로 과거 검증",
    href: "/backtest/new?asset=crypto&symbol=btc",
  },
  {
    Icon: Wallet,
    title: "가상 포트폴리오",
    desc: "실 매매 없이 보유 PnL 추적",
    href: "/portfolio",
  },
  {
    Icon: ArrowLeftRight,
    title: "비교 차트",
    desc: "여러 종목 추세 · 상관 비교",
    href: "/compare",
  },
] as const;

export function OnboardingBanner() {
  // SSR/hydration mismatch 회피 — mounted 후에만 표시 결정.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setVisible(true);
    } catch {
      /* localStorage 불가 환경 — 표시 안 함 */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section className="relative mb-8 rounded-lg border border-line bg-surface/40 p-4 sm:p-5">
      <button
        type="button"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
      >
        <X size={14} aria-hidden="true" />
      </button>

      <p className="text-sm font-semibold text-fg">처음 오셨나요? 👋</p>
      <p className="mt-1 text-xs text-fg-muted">
        코인 · 해외주식 · 국내주식 시세를 한 곳에서 보고, 같은 화면에서 일봉
        백테스트까지. 핵심 기능을 둘러보세요.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({Icon, title, desc, href}) => (
          <Link
            key={href}
            href={href}
            onClick={dismiss}
            className="group flex items-start gap-2.5 rounded-md border border-line bg-bg p-3 transition-colors hover:border-fg"
          >
            <Icon
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-fg-muted group-hover:text-fg"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-fg group-hover:text-accent">
                {title}
              </span>
              <span className="text-[11px] text-fg-muted">{desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 text-[11px] text-fg-subtle underline hover:text-fg"
      >
        다시 보지 않기
      </button>
    </section>
  );
}
