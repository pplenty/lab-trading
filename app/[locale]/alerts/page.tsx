import type {Metadata} from "next";
import {AlertsPanel} from "@/components/panels/AlertsPanel";

// /ko/alerts — 사용자 가격 알림 일괄 관리 페이지.
// localStorage 의존 — 모든 알림 list + 검색 + 자산군 필터 + 일괄 관리.

export const metadata: Metadata = {
  title: "가격 알림 관리",
  description:
    "설정한 가격 알림을 한 곳에서 관리. 활성 / 도달 / 전체 탭 + 자산군 필터.",
  robots: {index: false},
};

export default function AlertsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          사용자 자산
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          가격 알림
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          설정한 가격 알림 일괄 관리. 종목 페이지 진입 시 조건 도달 자동 감지 ·
          브라우저 localStorage 저장.
        </p>
      </header>

      <AlertsPanel />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          알림은 브라우저별 별도 저장됩니다 (다중 device 동기화 X). 실거래 알림이
          아닌 정보 제공 목적입니다.
        </p>
      </footer>
    </main>
  );
}
