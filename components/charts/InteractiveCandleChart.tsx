"use client";

import {useEffect, useMemo, useState} from "react";
import {LineChart as LineIcon, Maximize2, X} from "lucide-react";
import {CandleChart, type ChartOverlay} from "./CandleChart";

// 종목 상세 차트 + indicator overlay 토글.
// props.availableOverlays 의 id 를 토글하면 차트에 해당 라인 add/remove.

type Props = {
  candles: React.ComponentProps<typeof CandleChart>["candles"];
  height?: number;
  showVolume?: boolean;
  /** 모든 가능 overlay — 사용자가 chip 클릭해 visible 토글. */
  availableOverlays: ChartOverlay[];
  /** localStorage 키 — 사용자 선택 persistent. */
  storageKey?: string;
  /** info bar 표시 통화 (KRW / USD). */
  currency?: string;
  /** info bar 소수점 자릿수. */
  priceDigits?: number;
};

const DEFAULT_STORAGE_KEY = "lab-trading-chart-overlays";

export function InteractiveCandleChart({
  candles,
  height,
  showVolume,
  availableOverlays,
  storageKey = DEFAULT_STORAGE_KEY,
  currency,
  priceDigits,
}: Props) {
  // 선택된 overlay id Set — localStorage 동기.
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const [viewportH, setViewportH] = useState(600);

  // fullscreen 시 Esc 닫기 + body scroll lock + viewport 높이 추적
  useEffect(() => {
    if (!fullscreen) return;
    setViewportH(window.innerHeight);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    function onResize() {
      setViewportH(window.innerHeight);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreen]);

  // mount 시 localStorage 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setVisible(new Set(arr.filter((v): v is string => typeof v === "string")));
      }
    } catch {}
  }, [storageKey]);

  // visible 변경 시 localStorage 동기
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...visible]));
    } catch {}
  }, [visible, storageKey]);

  const selectedOverlays = useMemo(
    () => availableOverlays.filter((o) => visible.has(o.id)),
    [availableOverlays, visible]
  );

  function toggle(id: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearAll() {
    setVisible(new Set());
  }

  const overlayChips =
    availableOverlays.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
          <LineIcon size={10} aria-hidden="true" className="mr-1 inline" />
          지표
        </span>
        {availableOverlays.map((ov) => {
          const active = visible.has(ov.id);
          return (
            <button
              key={ov.id}
              type="button"
              onClick={() => toggle(ov.id)}
              aria-pressed={active}
              className={
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors " +
                (active
                  ? "border-fg bg-fg/5 text-fg"
                  : "border-line bg-bg text-fg-muted hover:border-fg-subtle hover:text-fg")
              }
            >
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-3"
                style={{
                  background: ov.color,
                  outline: ov.dashed ? `1px dashed ${ov.color}` : undefined,
                  outlineOffset: -1,
                }}
              />
              {ov.label}
            </button>
          );
        })}
        {visible.size > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-[10px] text-fg-subtle hover:text-fg"
          >
            모두 끄기
          </button>
        )}
      </div>
    ) : null;

  if (fullscreen) {
    // chart 영역 = viewport - (헤더 + chip + 패딩) 대략
    const chartH = Math.max(320, viewportH - 130);
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-bg p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-fg-muted">전체화면 차트</span>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="전체화면 닫기 (Esc)"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-bg px-2.5 text-xs text-fg-muted transition-colors hover:border-fg hover:text-fg"
          >
            <X size={13} aria-hidden="true" />
            닫기
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CandleChart
            candles={candles}
            height={chartH}
            showVolume={showVolume}
            overlays={selectedOverlays}
            currency={currency}
            priceDigits={priceDigits}
          />
        </div>
        {overlayChips && <div className="mt-2">{overlayChips}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <CandleChart
          candles={candles}
          height={height}
          showVolume={showVolume}
          overlays={selectedOverlays}
          currency={currency}
          priceDigits={priceDigits}
        />
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label="차트 전체화면"
          title="전체화면"
          className="absolute bottom-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-bg/80 text-fg-subtle backdrop-blur transition-colors hover:border-fg hover:text-fg"
        >
          <Maximize2 size={13} aria-hidden="true" />
        </button>
      </div>

      {overlayChips}
    </div>
  );
}
