import type {Metadata} from "next";
import {NotesPanel} from "@/components/panels/NotesPanel";

// /ko/notes — 사용자 종목 메모 일괄 관리.
// localStorage 의존 — 최신순 / 종목별 group + 자산군 필터 + 본문/종목명 검색.

export const metadata: Metadata = {
  title: "내 메모 관리",
  description:
    "종목별로 작성한 메모를 한 곳에서 관리. 최신순 / 종목별 group · 자산군 필터 · 본문 검색.",
  robots: {index: false},
};

export default function NotesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          사용자 자산
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          내 메모
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          종목별 작성 메모 일괄 관리. 작성 시점 가격 컨텍스트 보존 · 인라인 편집
          · 브라우저 localStorage 저장.
        </p>
      </header>

      <NotesPanel />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          메모는 브라우저별 별도 저장됩니다 (다중 device 동기화 X). 투자 권유가
          아니며 정보 제공 목적입니다.
        </p>
      </footer>
    </main>
  );
}
