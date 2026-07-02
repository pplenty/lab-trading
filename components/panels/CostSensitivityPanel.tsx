import type {CostSensitivity} from "@/lib/backtest/cost-sensitivity";

// 거래비용 민감도 — 수수료·슬리피지를 0×~3× 배율로 바꾼 총수익률 막대 + 단순 보유
// 기준선(점선). 우위(edge)가 어느 비용 수준까지 살아남는지 진단. 스윕(파라미터)·
// walk-forward(미래 일반화)와 짝인 강건성 3번째 축. render-only.
// a11y: 색만으로 의미전달 X — verdict 한국어 텍스트 + ▲/⚠ + 수치 병기.

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtPp(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%p`;
}

export function CostSensitivityPanel({
  sensitivity,
  loading,
  /** 거래 0건 — 비용이 결과에 영향 없음. */
  noTrades,
}: {
  sensitivity: CostSensitivity | null;
  loading: boolean;
  noTrades: boolean;
}) {
  if (!sensitivity && !loading && !noTrades) return null;

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">거래비용 민감도</h3>
        <span className="text-[10px] text-fg-subtle">
          강건성 진단 · 수수료 0.1% + 슬리피지 0.05% 의 배율별 성과
        </span>
      </header>

      {noTrades ? (
        <p className="py-2 text-xs text-fg-subtle">
          체결이 발생하지 않아 비용이 결과에 영향을 주지 않습니다.
        </p>
      ) : loading && !sensitivity ? (
        <p className="py-2 text-center text-xs text-fg-subtle">
          비용 민감도 계산 중…
        </p>
      ) : sensitivity ? (
        <CostSensitivityBody s={sensitivity} />
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-fg-subtle">
        같은 신호·거래에 수수료와 슬리피지만 0~3배로 바꿔 재계산한 결과입니다. 낮은
        배율에서 단순 보유 대비 우위가 사라질수록 실거래 비용·체결 미끄러짐에 취약한
        전략입니다. 과거 성과는 미래를 보장하지 않습니다.
      </p>
    </section>
  );
}

function verdictParts(s: CostSensitivity): {
  tone: string;
  prefix: string;
  text: string;
} {
  const be =
    s.breakEvenMultiple === null ? "" : s.breakEvenMultiple.toFixed(1);
  switch (s.verdict) {
    case "robust":
      return {
        tone: "text-[var(--color-up)]",
        prefix: "▲ ",
        text: "비용 강건 — 3배 비용에서도 단순 보유 대비 우위 유지",
      };
    case "moderate":
      return {
        tone: "text-fg-muted",
        prefix: "",
        text: `여유 있음 — 비용이 약 ${be}배가 되면 우위 소멸`,
      };
    case "thin":
      return {
        tone: "text-[var(--color-down)]",
        prefix: "⚠ ",
        text: `여유 얇음 — 비용이 약 ${be}배만 돼도 우위 소멸`,
      };
    case "cost-eaten":
      return {
        tone: "text-[var(--color-down)]",
        prefix: "⚠ ",
        text: `비용 잠식 — 무비용 우위 ${fmtPp(s.edgeAt0xPp)} 가 현재 비용에서 소멸 (분기 약 ${be}배)`,
      };
    case "no-edge":
      return {
        tone: "text-fg-muted",
        prefix: "",
        text: "우위 없음 — 비용을 없애도 단순 보유 대비 우위가 없음",
      };
  }
}

function CostSensitivityBody({s}: {s: CostSensitivity}) {
  const {points, buyHoldPct} = s;
  const {tone, prefix, text} = verdictParts(s);

  const W = 100;
  const H = 40;
  const pcts = points.map((p) => p.pct);
  const top = Math.max(...pcts, buyHoldPct, 0);
  const bottom = Math.min(...pcts, buyHoldPct, 0);
  const span = top - bottom || 1;
  const y = (pct: number) => (H * (top - pct)) / span;
  const zeroY = y(0);
  const bhY = y(buyHoldPct);
  const slot = W / points.length;
  const barW = Math.max(slot * 0.7, 0.5);
  const curIdx = points.findIndex((p) => p.multiple === 1);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`거래비용 민감도 — 배율 0×~3× 총수익률, 현재 1× ${
          curIdx >= 0 ? fmtPct(points[curIdx].pct) : "—"
        }, 단순 보유 ${fmtPct(buyHoldPct)}`}
      >
        {/* zero baseline — 부호 인코딩에 load-bearing (스윕과 동일 fg-subtle). */}
        <line
          x1="0"
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--color-fg-subtle)"
          strokeWidth="0.3"
        />
        {/* 단순 보유 기준선 — 점선으로 구분 (겹치면 zero 만 표시). */}
        {Math.abs(bhY - zeroY) > 0.6 && (
          <line
            x1="0"
            x2={W}
            y1={bhY}
            y2={bhY}
            stroke="var(--color-fg-subtle)"
            strokeWidth="0.3"
            strokeDasharray="1.6 1.2"
          />
        )}
        {points.map((p, i) => {
          const x = i * slot + (slot - barW) / 2;
          const yv = y(p.pct);
          const h = Math.max(Math.abs(yv - zeroY), 0.3);
          const barY = Math.min(yv, zeroY);
          const isCur = i === curIdx;
          return (
            <g key={p.multiple}>
              <rect
                x={x}
                y={barY}
                width={barW}
                height={h}
                fill={p.pct >= 0 ? "var(--color-up)" : "var(--color-down)"}
                opacity={isCur ? 1 : 0.5}
              />
              {/* 현재(1×) = 전체높이 하이라이트 박스 — 고대비 fg (스윕과 동일). */}
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
            </g>
          );
        })}
      </svg>
      <div
        className="grid text-center text-[9px] tabular-nums text-fg-subtle"
        style={{gridTemplateColumns: `repeat(${points.length}, 1fr)`}}
      >
        {points.map((p) => (
          <span
            key={p.multiple}
            className={p.multiple === 1 ? "font-medium text-fg-muted" : ""}
          >
            {p.multiple}×
          </span>
        ))}
      </div>
      <div className={`text-[11px] font-medium ${tone}`}>
        {prefix}
        {text}
        <span className="ml-1 font-normal text-fg-subtle tabular-nums">
          (현재 우위 {fmtPp(s.edgeAt1xPp)} · 비용 드래그 {s.costDragPp.toFixed(1)}
          %p · 체결 {s.fills}회 · 점선=단순 보유 {fmtPct(buyHoldPct)})
        </span>
      </div>
    </div>
  );
}
