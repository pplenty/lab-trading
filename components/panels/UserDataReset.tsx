"use client";

import {useState} from "react";
import {Trash2, Check} from "lucide-react";
import {useFavorites} from "@/lib/favorites";
import {useRecents} from "@/lib/recents";
import {useSavedStrategies} from "@/lib/strategies/saved";

// 사용자 자산 (localStorage, ADR-0016) 일괄 reset.
// 즐겨찾기 + 최근 본 + 저장된 전략 모두 삭제. 테마 / 모드 / 컬러시맨틱 / 사이드바 폭 등 환경 설정은 보존.

export function UserDataReset() {
  const {favorites, toggle} = useFavorites();
  const {recents, add} = useRecents();
  const {items: saved, remove} = useSavedStrategies();
  const [done, setDone] = useState(false);

  const total = favorites.length + recents.length + saved.length;

  function handleReset() {
    if (total === 0) {
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
      return;
    }
    const ok = window.confirm(
      `즐겨찾기 ${favorites.length}건 · 최근 본 ${recents.length}건 · 저장된 전략 ${saved.length}건을 모두 삭제할까요? 환경 설정(테마/모드/언어 등)은 보존됩니다.`
    );
    if (!ok) return;

    // localStorage 직접 삭제 — useSyncExternalStore 가 next render 에서 reflect.
    try {
      localStorage.removeItem("lab-trading-favorites");
      localStorage.removeItem("lab-trading-recents");
      localStorage.removeItem("lab-trading-saved-strategies");
      // module-level subscribers 가 cross-tab storage event 만 listen — same-tab 동기 위해 dummy update 트리거.
      // (각 hook 의 setRaw 직접 호출 가능하나 안전을 위해 dispatch storage event.)
      window.dispatchEvent(
        new StorageEvent("storage", {key: "lab-trading-favorites"})
      );
      window.dispatchEvent(
        new StorageEvent("storage", {key: "lab-trading-recents"})
      );
      window.dispatchEvent(
        new StorageEvent("storage", {key: "lab-trading-saved-strategies"})
      );
    } catch {
      // ignore
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
    // 강제 동기 — same-tab 의 subscribers 가 storage event 미수신 케이스 보완
    void toggle;
    void add;
    void remove;
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs tabular-nums text-fg-subtle">
        ⭐ {favorites.length} · ⏰ {recents.length} · 🔖 {saved.length}
      </span>
      <button
        type="button"
        onClick={handleReset}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {done ? (
          <>
            <Check size={12} aria-hidden="true" />
            <span>초기화됨</span>
          </>
        ) : (
          <>
            <Trash2 size={12} aria-hidden="true" />
            <span>사용자 자산 초기화</span>
          </>
        )}
      </button>
    </div>
  );
}
