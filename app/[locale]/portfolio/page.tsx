import type {Metadata} from "next";
import {PortfolioPanel} from "@/components/panels/PortfolioPanel";

// /ko/portfolio — 가상 포트폴리오 (paper trading) 통합 페이지.
// 보유 종목 + per-symbol unrealized PnL + 확정 PnL + 전체 거래 이력.
// localStorage 의존 — client 가 보유 종목들의 quote 를 batch fetch.

export const metadata: Metadata = {
  title: "가상 포트폴리오",
  description:
    "실제 매매 없이 시나리오 검증. 보유 종목, 미실현/확정 PnL, 거래 이력 통합 관리.",
  robots: {index: false},
};

export default function PortfolioPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          사용자 자산
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          가상 포트폴리오
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          종목 상세 페이지 헤더의 "💼 가상매매" 버튼으로 기록한 거래 통합 관리.
          실 매매 없이 시나리오 검증 (paper trading) · 브라우저 저장.
        </p>
      </header>

      <PortfolioPanel />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          현재가는 자산군별 라이브 시세 (60s KV 캐시). 거래 기록은 브라우저별
          별도 저장 (다중 device 동기화 X).
        </p>
        <p className="mt-1">
          실제 매매가 아니므로 슬리피지·수수료 미반영. 평가액 계산은 단순{" "}
          <code className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">
            현재가 × units
          </code>.
        </p>
      </footer>
    </main>
  );
}
