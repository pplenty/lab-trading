import {Link} from "@/i18n/navigation";
import {FinancialDelta} from "@/components/FinancialDelta";
import type {AssetClass, Quote} from "@/lib/types";

// 자산군 시세 / 랭킹 공용 표.
// 코인은 `/crypto/<symbol>` 링크, 미장은 `/us/<symbol>`, 국내는 `/kr/<symbol>` 로 자동 라우팅.
// 화폐 표기: KRW 면 정수 표시 + ₩ 기호, USD/USDT 는 소수 둘째 자리.
// listQuotes 가 currency 를 표명하므로 같은 표에 KRW/USDT 가 섞여도 안전.

type Props = {
  class: AssetClass;
  quotes: Quote[];
  /** name lookup — registry 의 한글/영문명. 미제공 시 symbol 만 표시. */
  nameMap?: Record<string, {name: string; nameKo?: string}>;
  locale: string;
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();
function priceFmt(currency: string): Intl.NumberFormat {
  let f = FORMATTERS.get(currency);
  if (!f) {
    const isKrw = currency === "KRW";
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: isKrw ? 0 : 2,
      minimumFractionDigits: isKrw ? 0 : 2,
    });
    FORMATTERS.set(currency, f);
  }
  return f;
}

const volFmt = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function QuoteTable({class: cls, quotes, nameMap, locale}: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-[10px] uppercase tracking-wider text-fg-subtle">
          <tr>
            <th className="px-4 py-2 text-left font-medium">#</th>
            <th className="px-4 py-2 text-left font-medium">Asset</th>
            <th className="px-4 py-2 text-right font-medium">Price</th>
            <th className="px-4 py-2 text-right font-medium">24h Δ</th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              24h High
            </th>
            <th className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              24h Low
            </th>
            <th className="hidden px-4 py-2 text-right font-medium md:table-cell">
              Volume
            </th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-4 py-6 text-center text-fg-muted"
              >
                No data
              </td>
            </tr>
          ) : (
            quotes.map((q, i) => {
              const meta = nameMap?.[q.symbol];
              const name = meta
                ? locale === "ko" && meta.nameKo
                  ? meta.nameKo
                  : meta.name
                : q.symbol.toUpperCase();
              return (
                <tr
                  key={`${cls}:${q.symbol}`}
                  className="border-t border-line transition-colors hover:bg-surface/60"
                >
                  <td className="px-4 py-2 text-fg-subtle tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/${cls}/${q.symbol}`}
                      prefetch={false}
                      className="font-medium text-fg hover:text-accent"
                    >
                      {name}
                      <span className="ml-2 text-xs text-fg-subtle">
                        {q.symbol.toUpperCase()}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-fg">
                    {priceFmt(q.currency).format(q.price)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <FinancialDelta changePct={q.changePct24h} digits={2} />
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-fg-muted sm:table-cell">
                    {q.high24h !== undefined
                      ? priceFmt(q.currency).format(q.high24h)
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-fg-muted sm:table-cell">
                    {q.low24h !== undefined
                      ? priceFmt(q.currency).format(q.low24h)
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-fg-muted md:table-cell">
                    {q.volume24h !== undefined
                      ? volFmt.format(q.volume24h)
                      : "—"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
