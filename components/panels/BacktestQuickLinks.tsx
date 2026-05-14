import {Link} from "@/i18n/navigation";

// 대시보드 백테스트 빠른 진입 — 자산군별 대표 종목 1-2 개로 1-클릭 진입.
// `/backtest/new?asset=...&symbol=...` URL params 로 BacktestPanel prefill.

const QUICK_LINKS: Array<{
  asset: "crypto" | "us" | "kr";
  symbol: string;
  label: string;
  hint: string;
}> = [
  {asset: "crypto", symbol: "btc", label: "비트코인", hint: "Upbit live · 200일"},
  {asset: "crypto", symbol: "eth", label: "이더리움", hint: "Upbit live · 200일"},
  {asset: "us", symbol: "aapl", label: "Apple", hint: "Twelve Data demo · GBM"},
  {asset: "us", symbol: "tsla", label: "Tesla", hint: "Twelve Data demo · GBM"},
  {asset: "kr", symbol: "005930", label: "삼성전자", hint: "KIS demo · GBM"},
  {asset: "kr", symbol: "000660", label: "SK하이닉스", hint: "KIS demo · GBM"},
];

export function BacktestQuickLinks({heading}: {heading: string}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {heading}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((q) => (
          <li key={`${q.asset}:${q.symbol}`}>
            <Link
              href={`/backtest/new?asset=${q.asset}&symbol=${q.symbol}`}
              className="flex flex-col gap-1 rounded-lg border border-line bg-bg p-3 transition-colors hover:border-fg"
            >
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                <span>{q.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
                  {q.asset}
                </span>
              </div>
              <p className="text-[11px] text-fg-subtle">{q.hint}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
