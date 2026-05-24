"use client";

import {useEffect, useRef, useState} from "react";
import {Play, RefreshCw} from "lucide-react";
import {LineChart, type LineSeries} from "./LineChart";

// SVG path 의 stroke-dashoffset 트릭으로 좌→우 점진 draw 애니메이션.
// 백테스트 결과 mount 시 1.4초 재생 + ▶ Replay 버튼.
// prefers-reduced-motion: reduce 사용자는 즉시 그림.

type Props = {
  series: LineSeries[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
  /** 애니메이션 지속 시간 ms (default 1400). */
  durationMs?: number;
};

export function ReplayLineChart({
  series,
  width,
  height,
  className,
  ariaLabel,
  durationMs = 1400,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [key, setKey] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const paths =
      containerRef.current.querySelectorAll<SVGPathElement>("path");
    if (paths.length === 0) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dur = mq.matches ? 0 : durationMs;

    paths.forEach((p) => {
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    setPlaying(true);

    let rafId2 = 0;
    let timeoutId = 0;
    const rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(() => {
        paths.forEach((p) => {
          p.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
          p.style.strokeDashoffset = "0";
        });
        timeoutId = window.setTimeout(() => {
          setPlaying(false);
          // 정리 — dasharray/dashoffset reset (이후 색상 변경 등 부드럽게)
          paths.forEach((p) => {
            p.style.transition = "none";
            p.style.strokeDasharray = "";
            p.style.strokeDashoffset = "";
          });
        }, dur + 60);
      });
    });

    return () => {
      cancelAnimationFrame(rafId1);
      if (rafId2) cancelAnimationFrame(rafId2);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [key, durationMs]);

  function replay() {
    setKey((k) => k + 1);
  }

  return (
    <div className="relative">
      <div ref={containerRef} key={key}>
        <LineChart
          series={series}
          width={width}
          height={height}
          className={className}
          ariaLabel={ariaLabel}
        />
      </div>
      <button
        type="button"
        onClick={replay}
        disabled={playing}
        aria-label="백테스트 재생"
        title="결과 다시 재생"
        className="absolute left-2 top-2 inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg/80 px-2 text-[11px] font-medium text-fg backdrop-blur transition-opacity hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {playing ? (
          <>
            <RefreshCw size={11} aria-hidden="true" className="animate-spin" />
            재생 중…
          </>
        ) : (
          <>
            <Play size={11} aria-hidden="true" />
            재생
          </>
        )}
      </button>
    </div>
  );
}
