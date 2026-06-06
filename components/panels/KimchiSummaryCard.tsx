import {Link} from "@/i18n/navigation";
import type {KimchiSnapshot} from "@/lib/data/kimchi";
import {getCryptoBySymbol} from "@/lib/symbols/registry";

// /market(시장 심리)용 컴팩트 김치 프리미엄 요약 — 평균 + BTC + 상·하위 종목. 전체 표는 /crypto.
// 양수(김프) = 한국이 비쌈 → --color-up, 음수(역프) → --color-down (컬러 시맨틱 토글 존중).

function premiumColor(p: number): string {
  return p > 0.01
    ? "var(--color-up)"
    : p < -0.01
    ? "var(--color-down)"
    : "var(--color-fg-muted)";
}
function fmtPct(p: number): string {
  return `${p > 0 ? "+" : ""}${p.toFixed(2)}%`;
}

function nameOf(symbol: string, locale: string): string {
  const e = getCryptoBySymbol(symbol);
  if (!e) return symbol.toUpperCase();
  return locale === "ko" && e.nameKo ? e.nameKo : e.name;
}

export function KimchiSummaryCard({
  snapshot,
  locale,
}: {
  snapshot: KimchiSnapshot | null;
  locale: string;
}) {
  if (!snapshot || snapshot.rows.length === 0) return null;
  const {rows, avgPremium, btc, fx} = snapshot;
  const top = rows[0]; // 최고 프리미엄
  const bottom = rows[rows.length - 1]; // 최저(역프)

  return (
    <Link
      href="/crypto"
      className="group block rounded-lg border border-line bg-surface/30 p-5 transition-colors hover:border-fg"
    >
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg group-hover:text-accent">
          🇰🇷 김치 프리미엄
        </h3>
        <span className="text-[11px] text-fg-subtle group-hover:text-fg">
          코인 전체 →
        </span>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-line bg-bg p-3">
          <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
            평균
          </div>
          <div
            className="mt-0.5 text-2xl font-bold tabular-nums leading-none"
            style={{color: premiumColor(avgPremium)}}
          >
            {fmtPct(avgPremium)}
          </div>
        </div>
        {btc && (
          <div className="rounded-md border border-line bg-bg p-3">
            <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
              비트코인
            </div>
            <div
              className="mt-0.5 text-2xl font-bold tabular-nums leading-none"
              style={{color: premiumColor(btc.premiumPct)}}
            >
              {fmtPct(btc.premiumPct)}
            </div>
          </div>
        )}
      </div>

      <dl className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">
            최고 <span className="text-fg">{nameOf(top.symbol, locale)}</span>
          </dt>
          <dd
            className="font-semibold tabular-nums"
            style={{color: premiumColor(top.premiumPct)}}
          >
            {fmtPct(top.premiumPct)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-fg-muted">
            최저 <span className="text-fg">{nameOf(bottom.symbol, locale)}</span>
          </dt>
          <dd
            className="font-semibold tabular-nums"
            style={{color: premiumColor(bottom.premiumPct)}}
          >
            {fmtPct(bottom.premiumPct)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-line pt-2 text-[10px] text-fg-subtle">
        Upbit vs 글로벌 USD × 환율 · 양수 = 한국이 비쌈 · 환율 {Math.round(fx.rate)}/USD
      </p>
    </Link>
  );
}
