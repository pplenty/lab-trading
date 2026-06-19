import {analyzeSweep, type SweepPoint} from "@/lib/backtest/sweep";
import type {StrategyParam} from "@/lib/backtest/types";

// 파라미터 민감도 — 전략 파라미터를 단독 변화시킨 과거 총수익률을 막대로 보여
// "넓은 안정 고원(강건)" vs "좁은 봉우리(과최적화)"를 진단. BacktestPanel 이
// client-side 로 스윕(runBacktest N회)해 points 를 만들어 전달. 여기는 렌더 전용.
// a11y: 색만으로 의미전달 X — verdict 텍스트 + 부호로 방향 병기. 막대는 보조 시각.

// current 는 스윕 계산 시점의 파라미터 값(스냅샷) — live params 와 불일치(드래그 중
// stale) 로 현재 point 가 누락돼 verdict 가 오염되는 것 방지 (backtest-validator P0/P1).
export type Sweep = {param: StrategyParam; points: SweepPoint[]; current: number};

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function ParamSweepPanel({
  sweeps,
  loading,
}: {
  sweeps: Sweep[];
  loading: boolean;
}) {
  if (sweeps.length === 0 && !loading) return null;

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">파라미터 민감도</h3>
        <span className="text-[10px] text-fg-subtle">
          과최적화 진단 · 각 파라미터 단독 변화 시 총수익률
        </span>
      </header>

      {loading && sweeps.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-subtle">민감도 계산 중…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {sweeps.map((s) => (
            <SweepChart key={s.param.key} sweep={s} />
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-fg-subtle">
        같은 종목·기간에서 한 파라미터만 격자로 바꾼 과거 결과입니다. 고른 값이 좁은
        봉우리(인접 값에서 급락)면 과최적화 신호일 수 있습니다. 과거 성과는 미래를
        보장하지 않습니다.
      </p>
    </section>
  );
}

function SweepChart({sweep}: {sweep: Sweep}) {
  const {param, points, current} = sweep;
  const curPoint = points.find((p) => p.value === current);
  // curPoint 없으면 analysis 생략 — 0 fallback 으로 verdict 오염 방지.
  const currentPct = curPoint?.pct ?? null;
  const analysis = curPoint ? analyzeSweep(points, current, curPoint.pct) : null;

  const W = 100;
  const H = 40;
  const pcts = points.map((p) => p.pct);
  const top = Math.max(...pcts, 0);
  const bottom = Math.min(...pcts, 0);
  const span = top - bottom || 1;
  const y = (pct: number) => (H * (top - pct)) / span;
  const zeroY = y(0);
  const slot = W / points.length;
  const barW = Math.max(slot * 0.7, 0.5);

  const bestIdx = points.reduce(
    (bi, p, i, arr) => (p.pct > arr[bi].pct ? i : bi),
    0
  );
  const curIdx = points.findIndex((p) => p.value === current);

  const verdictTone =
    analysis?.verdict === "robust"
      ? "text-[var(--color-up)]"
      : analysis?.verdict === "fragile"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  const verdictText =
    analysis == null
      ? ""
      : analysis.verdict === "robust"
      ? `강건 — ${current} 부근이 넓은 안정 고원`
      : analysis.verdict === "fragile"
      ? `주의 — ${current} 는 좁은 봉우리 (과최적화 의심)`
      : analysis.verdict === "flat"
      ? "민감도 낮음 — 이 파라미터는 결과에 거의 영향 없음"
      : `개선 여지 — 최고는 ${analysis.bestValue} (${fmtPct(analysis.bestPct)})`;
  const verdictPrefix =
    analysis?.verdict === "robust"
      ? "▲ "
      : analysis?.verdict === "fragile"
      ? "⚠ "
      : "";

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-fg">
          {param.labelKo}{" "}
          <span className="text-fg-subtle">
            (현재 {current} · {currentPct === null ? "—" : fmtPct(currentPct)})
          </span>
        </span>
        {analysis && (
          <span className={`text-[11px] font-medium ${verdictTone}`}>
            {verdictPrefix}
            {verdictText}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`${param.labelKo} 민감도 — ${points.length}개 값, 최고 ${analysis ? analysis.bestValue : "?"}, 현재 ${current}`}
      >
        {/* zero baseline — 부호 인코딩에 load-bearing 이라 line 보다 진한 fg-subtle (AA). */}
        <line
          x1="0"
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--color-fg-subtle)"
          strokeWidth="0.3"
        />
        {points.map((p, i) => {
          const x = i * slot + (slot - barW) / 2;
          const yv = y(p.pct);
          const h = Math.max(Math.abs(yv - zeroY), 0.3);
          const barY = Math.min(yv, zeroY);
          const isCur = i === curIdx;
          const isBest = i === bestIdx;
          return (
            <g key={p.value}>
              <rect
                x={x}
                y={barY}
                width={barW}
                height={h}
                fill={
                  p.pct >= 0 ? "var(--color-up)" : "var(--color-down)"
                }
                opacity={isCur ? 1 : 0.5}
              />
              {/* 현재값 = 전체높이 하이라이트 박스, 최고 = dot. accent 는 다크 저대비
                  (2.5:1) 라 고대비 fg 로. 형태(박스 vs dot)로 구분. */}
              {isCur && (
                <rect
                  x={x - 0.4}
                  y={0.4}
                  width={barW + 0.8}
                  height={H - 0.8}
                  fill="none"
                  stroke="var(--color-fg)"
                  strokeWidth="0.5"
                />
              )}
              {isBest && !isCur && (
                <circle
                  cx={x + barW / 2}
                  cy={Math.max(1.2, Math.min(yv, zeroY) - 1.2)}
                  r="1"
                  fill="var(--color-fg)"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-0.5 flex justify-between text-[9px] tabular-nums text-fg-subtle">
        <span>{points[0].value}</span>
        {analysis && analysis.bestValue !== current && (
          <span className="font-medium text-fg-muted">
            최고 {analysis.bestValue}
          </span>
        )}
        <span>{points[points.length - 1].value}</span>
      </div>
    </div>
  );
}
