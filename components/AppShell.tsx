"use client";

import {useEffect, useRef} from "react";
import {useTranslations} from "next-intl";
import {AssetSidebar} from "@/components/AssetSidebar";
import {ChevronRightIcon} from "@/components/icons";
import {useLocalStorageString} from "@/lib/storage";

const SIDEBAR_OPEN_KEY = "lab-trading-sidebar-open";
const SIDEBAR_WIDTH_KEY = "lab-trading-sidebar-width";
const DEFAULT_WIDTH = 224; // 14rem
const MIN_WIDTH = 192;
const MAX_WIDTH = 384;

// 모든 페이지에 데스크톱 좌측 sticky 사이드바 (yutils AppShell 차용).
// lg+ 만 노출. 모바일은 Header 의 햄버거 → drawer (MobileSidebarTrigger).
// 우측 1px drag handle 로 너비 192-384 px 조절 (localStorage 영구).
//
// `#main-content` id + tabIndex={-1} 은 Skip-to-content 링크의 점프 대상.
export function AppShell({children}: {children: React.ReactNode}) {
  const t = useTranslations("sidebar");
  const [openStr, setOpenStr] = useLocalStorageString(SIDEBAR_OPEN_KEY, "true");
  const [widthStr, setWidthStr] = useLocalStorageString(
    SIDEBAR_WIDTH_KEY,
    String(DEFAULT_WIDTH)
  );
  const open = openStr !== "false";
  const parsedWidth = Number(widthStr);
  const width = Number.isFinite(parsedWidth)
    ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsedWidth))
    : DEFAULT_WIDTH;

  const draggingRef = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      setWidthStr(String(next));
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [setWidthStr]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  }

  return (
    <div className="flex flex-1">
      {open ? (
        <aside
          style={{width: `${width}px`}}
          className="hidden shrink-0 lg:block"
        >
          <div className="sticky top-0 flex max-h-screen border-r border-line">
            <div className="sidebar-scroll min-w-0 flex-1 overflow-y-auto p-4">
              <AssetSidebar onClose={() => setOpenStr("false")} />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("resize")}
              aria-valuenow={width}
              aria-valuemin={MIN_WIDTH}
              aria-valuemax={MAX_WIDTH}
              title={t("resize")}
              tabIndex={0}
              onMouseDown={startDrag}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 32 : 8;
                let next: number | null = null;
                if (e.key === "ArrowLeft") next = width - step;
                else if (e.key === "ArrowRight") next = width + step;
                else if (e.key === "Home") next = MIN_WIDTH;
                else if (e.key === "End") next = MAX_WIDTH;
                if (next !== null) {
                  e.preventDefault();
                  setWidthStr(
                    String(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next)))
                  );
                }
              }}
              className="w-1 shrink-0 cursor-ew-resize bg-transparent transition-colors hover:bg-accent/40 active:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
        </aside>
      ) : (
        <div className="hidden shrink-0 border-r border-line lg:block">
          <button
            type="button"
            onClick={() => setOpenStr("true")}
            aria-label={t("expand")}
            title={t("expand")}
            className="sticky top-6 m-2 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
      <div
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 outline-none"
      >
        {children}
      </div>
    </div>
  );
}
