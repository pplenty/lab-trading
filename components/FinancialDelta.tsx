// 변동률 / 변동가 표시 — 부호 + 화살표 + 컬러 (컨벤션 I, ADR-0012).
// 색만으로 의미 전달 X — 화살표(▲/▼) + 부호(+/-) 병기로 색맹 대응.

type Props = {
  changePct: number;
  /** 변동 절대가 (옵션, 함께 표시). */
  changeAbs?: number;
  /** 화폐 코드 (changeAbs 와 함께). 미지정 시 단순 숫자. */
  currency?: string;
  /** 소수점 자리수. */
  digits?: number;
  className?: string;
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function fmtNumber(currency: string | undefined, digits: number): Intl.NumberFormat {
  const key = `${currency ?? ""}:${digits}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    f = currency
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        })
      : new Intl.NumberFormat(undefined, {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        });
    FORMATTERS.set(key, f);
  }
  return f;
}

export function FinancialDelta({
  changePct,
  changeAbs,
  currency,
  digits = 2,
  className,
}: Props) {
  const up = changePct > 0;
  const down = changePct < 0;
  const arrow = up ? "▲" : down ? "▼" : "▬";
  const sign = up ? "+" : "";
  const colorClass = up ? "text-up" : down ? "text-down" : "text-fg-muted";

  const pctStr = `${sign}${changePct.toFixed(digits)}%`;
  const absStr =
    changeAbs === undefined
      ? null
      : ` ${sign}${fmtNumber(currency, currency ? digits : 2).format(changeAbs)}`;

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass} ${className ?? ""}`}>
      <span aria-hidden="true">{arrow}</span>
      <span className="tabular-nums">{pctStr}</span>
      {absStr && <span className="text-fg-subtle">{absStr}</span>}
    </span>
  );
}
