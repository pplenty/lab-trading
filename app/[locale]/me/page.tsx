import type {Metadata} from "next";
import {MeDashboard} from "@/components/panels/MeDashboard";

// /ko/me — 사용자 자산 통합 dashboard.
// 7 카테고리 (즐겨찾기/라벨/최근/알림/메모/포트폴리오/저장된 전략) 한 화면.
// 모두 localStorage → client-side. server 는 stub.

export const metadata: Metadata = {
  title: "내 활동 — 통합 dashboard",
  description:
    "즐겨찾기 · 최근 본 · 가격 알림 · 메모 · 가상 포트폴리오 · 저장된 전략 통합.",
  robots: {index: false},
};

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">사용자 자산</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          내 활동
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          즐겨찾기 · 최근 본 · 가격 알림 · 메모 · 가상 포트폴리오 · 저장된 전략 한
          화면.
        </p>
      </header>

      <MeDashboard />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          모든 자산은 브라우저 localStorage 에 저장됩니다 (다중 device 동기화 X · 광고
          식별자 X). 일괄 reset 은{" "}
          <a className="underline hover:text-fg" href="/ko/settings">
            /settings
          </a>.
        </p>
      </footer>
    </main>
  );
}
