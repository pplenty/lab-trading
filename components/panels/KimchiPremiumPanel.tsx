import {Link} from "@/i18n/navigation";
import type {KimchiSnapshot} from "@/lib/data/kimchi";
import {getCryptoBySymbol} from "@/lib/symbols/registry";

// 김치 프리미엄 패널 — Upbit KRW vs Binance USD(×환율) 괴리율. 한국 거래소 프리미엄/역프리미엄.
// 양수(김프) = 한국이 비쌈 → --color-up, 음수(역프) → --color-down (컬러 시맨틱 토글 존중).

function fmtKrw(v: number): string {
  return `₩${Math.round(v).toLocaleString("ko-KR")}`;
}
function fmtUsd(v: number): string {
  if (v >= 100) return `$${v.toFixed(2)}`;
  if (v >= 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
}
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

export function KimchiPremiumPanel({
  snapshot,
  locale,
  limit = 12,
}: {
  snapshot: KimchiSnapshot | null;
  locale: string;
  limit?: number;
}) {
  if (!snapshot || snapshot.rows.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-surface/30 p-5">
        <h2 className="text-sm font-semibold text-fg">김치 프리미엄</h2>
        <p className="mt-2 text-xs text-fg-muted">
          데이터를 일시적으로 가져올 수 없습니다 (Upbit / Binance / 환율).
        </p>
      </section>
    );
  }

  const {rows, avgPremium, btc, fx} = snapshot;
  const shown = rows.slice(0, limit);
  const updated = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(snapshot.updatedAt));

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-5">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">김치 프리미엄</h2>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            Upbit(KRW) vs Binance(USD×환율) 괴리율 · 양수 = 한국이 비쌈
          </p>
        </div>
        <div className="flex items-center gap-3 text-right">
          {btc && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
                BTC 김프
              </div>
              <div
                className="text-sm font-bold tabular-nums"
                style={{color: premiumColor(btc.premiumPct)}}
              >
                {fmtPct(btc.premiumPct)}
              </div>
            </div>
          )}
          <div>
            <div className="text-[9px] uppercase tracking-wider text-fg-subtle">
              평균
            </div>
            <div
              className="text-sm font-bold tabular-nums"
              style={{color: premiumColor(avgPremium)}}
            >
              {fmtPct(avgPremium)}
            </div>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-surface text-[10px] uppercase tracking-wider text-fg-subtle">
              <th className="px-3 py-1.5 text-left font-medium">코인</th>
              <th className="px-3 py-1.5 text-right font-medium">Upbit</th>
              <th className="hidden px-3 py-1.5 text-right font-medium sm:table-cell">
                Binance
              </th>
              <th className="px-3 py-1.5 text-right font-medium">프리미엄</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const e = getCryptoBySymbol(r.symbol);
              const name = e
                ? locale === "ko" && e.nameKo
                  ? e.nameKo
                  : e.name
                : r.symbol.toUpperCase();
              return (
                <tr
                  key={r.symbol}
                  className="border-b border-line/60 last:border-0 hover:bg-surface/60"
                >
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/crypto/${r.symbol}`}
                      prefetch={false}
                      className="font-medium text-fg hover:text-accent"
                    >
                      {name}
                      <span className="ml-1 text-[10px] text-fg-subtle">
                        {r.symbol.toUpperCase()}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg-muted">
                    {fmtKrw(r.upbitKrw)}
                  </td>
                  <td className="hidden px-3 py-1.5 text-right tabular-nums text-fg-subtle sm:table-cell">
                    {fmtUsd(r.binanceUsd)}
                  </td>
                  <td
                    className="px-3 py-1.5 text-right font-semibold tabular-nums"
                    style={{color: premiumColor(r.premiumPct)}}
                  >
                    {fmtPct(r.premiumPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-fg-subtle">
        <span>
          환율 {fmtKrw(fx.rate)}/USD · {fx.source}
          {fx.date ? ` (${fx.date} 기준)` : ""}
        </span>
        <span className="tabular-nums">{updated} 갱신 · 환율 기준 근사치</span>
      </footer>
    </section>
  );
}
