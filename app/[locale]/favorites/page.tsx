import type {Metadata} from "next";
import {FavoritesPanel} from "@/components/panels/FavoritesPanel";

// /ko/favorites — 즐겨찾기 통합 페이지 + 라벨링 (D3).
// 라벨별 그룹 / 자산군 필터 / 검색 / 인라인 라벨 편집.

export const metadata: Metadata = {
  title: "내 즐겨찾기",
  description:
    "관심 종목 통합 관리 — 자유 라벨 ('기술주', '방어주' 등) 으로 분류 + 자산군 필터 + 검색.",
  robots: {index: false},
};

export default function FavoritesPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          사용자 자산
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          내 즐겨찾기
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          관심 종목에 자유 라벨 (기술주 · 방어주 · 코인 · 관심 등) 을 붙여 분류.
          라벨 chip 으로 빠르게 필터.
        </p>
      </header>

      <FavoritesPanel />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>
          즐겨찾기와 라벨은 브라우저별 별도 저장됩니다 (localStorage). 다중 device
          동기화 X.
        </p>
      </footer>
    </main>
  );
}
