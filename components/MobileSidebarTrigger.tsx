"use client";

import {useEffect, useRef, useState} from "react";
import {Menu} from "lucide-react";
import {useTranslations} from "next-intl";
import {AssetSidebar} from "@/components/AssetSidebar";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 헤더 햄버거 + 모바일 drawer (yutils 차용).
// 데스크탑(lg+) hidden — AppShell 의 sticky 사이드바가 노출.
// a11y: drawer 열림 시 첫 focusable focus + Tab trap + Escape 닫기 + trigger 로 포커스 복원.
export function MobileSidebarTrigger() {
  const t = useTranslations("sidebar");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerContentRef.current;
    const trigger = triggerRef.current;

    const focusId = window.setTimeout(() => {
      if (!drawer) return;
      const first = drawer.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    }, 50);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (e.key !== "Tab" || !drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hidden && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !drawer.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !drawer.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusId);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [drawerOpen]);

  function handleDrawerContentClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a[href]")) {
      setDrawerOpen(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openDrawer")}
        aria-expanded={drawerOpen}
        aria-controls="mobile-sidebar-drawer"
        className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
      >
        <Menu size={16} aria-hidden="true" />
      </button>

      <div
        id="mobile-sidebar-drawer"
        role="dialog"
        aria-modal={drawerOpen}
        aria-hidden={!drawerOpen}
        aria-label={t("label")}
        className={`fixed inset-0 z-50 lg:hidden ${
          drawerOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        <div
          ref={drawerContentRef}
          className={`sidebar-scroll absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col overflow-y-auto bg-bg p-4 shadow-xl transition-transform duration-200 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={handleDrawerContentClick}
        >
          <AssetSidebar onClose={() => setDrawerOpen(false)} />
        </div>
      </div>
    </>
  );
}
