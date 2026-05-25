// 종목 N×N 상관행렬 — pearson ρ on daily log-returns.
// 색은 traffic light + intensity: |ρ| 가 클수록 진함.
// server-safe (정적).

type Props = {
  labels: string[];
  matrix: (number | null)[][];
  /** range label for footnote. */
  rangeLabel?: string;
};

function cellColor(rho: number | null): string {
  if (rho === null) return "transparent";
  // -1 → red, 0 → neutral, +1 → green.
  // 강도는 |ρ| 에 비례 (0 ~ 25% opacity).
  const intensity = Math.min(Math.abs(rho), 1);
  const alpha = (intensity * 0.25).toFixed(2);
  if (rho > 0) return `rgba(var(--color-up-rgb, 34, 197, 94), ${alpha})`;
  if (rho < 0) return `rgba(var(--color-down-rgb, 239, 68, 68), ${alpha})`;
  return "transparent";
}

function cellTextColor(rho: number | null): string {
  if (rho === null) return "var(--fg-subtle)";
  if (Math.abs(rho) > 0.5) return rho > 0 ? "var(--color-up)" : "var(--color-down)";
  return "var(--fg-muted)";
}

export function CorrelationMatrix({labels, matrix, rangeLabel}: Props) {
  if (labels.length < 2) {
    return (
      <div className="rounded-md border border-line bg-surface/30 p-4 text-xs text-fg-muted">
        2 종목 이상이면 상관 행렬이 표시됩니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="flex items-baseline justify-between border-b border-line bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        <span>일간 수익률 상관 행렬</span>
        {rangeLabel && (
          <span className="text-[10px] font-normal text-fg-subtle">
            {rangeLabel} pearson ρ
          </span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] text-fg-subtle">
          <tr>
            <th className="bg-bg/40 px-3 py-1.5"></th>
            {labels.map((l) => (
              <th
                key={l}
                className="bg-bg/40 px-2 py-1.5 text-center font-medium tracking-wider text-fg-muted"
              >
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={labels[i]} className="border-t border-line">
              <th className="bg-bg/40 px-3 py-1.5 text-right text-[10px] font-medium tracking-wider text-fg-muted">
                {labels[i]}
              </th>
              {row.map((rho, j) => (
                <td
                  key={`${i}-${j}`}
                  style={{
                    background: cellColor(rho),
                    color: cellTextColor(rho),
                  }}
                  className="px-2 py-1.5 text-center tabular-nums"
                >
                  {rho === null
                    ? "—"
                    : i === j
                    ? "·"
                    : rho.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line bg-bg/30 px-4 py-2 text-[10px] text-fg-subtle">
        <span className="inline-flex items-center gap-3">
          <span>
            <span
              aria-hidden="true"
              className="mr-1 inline-block h-2 w-3 rounded-sm align-middle"
              style={{background: "rgba(var(--color-up-rgb, 34, 197, 94), 0.25)"}}
            />
            같은 방향 (1)
          </span>
          <span>
            <span
              aria-hidden="true"
              className="mr-1 inline-block h-2 w-3 rounded-sm align-middle"
              style={{
                background: "rgba(var(--color-down-rgb, 239, 68, 68), 0.25)",
              }}
            />
            반대 방향 (-1)
          </span>
          <span className="text-fg-muted">
            대각 = 1 · 같은 자산은 자기 자신과 완전 동조
          </span>
        </span>
      </div>
    </div>
  );
}
