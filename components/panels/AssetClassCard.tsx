import {Link} from "@/i18n/navigation";
import {FinancialDelta} from "@/components/FinancialDelta";
import {Sparkline} from "@/components/charts/Sparkline";
import type {AssetClass, Quote} from "@/lib/types";

// 대시보드의 자산군 1개 카드.
// 헤더 + top gainers 3 + top losers 3 + "전체 보기" 진입.
// 데이터 부족 / fetch 실패 시 빈 슬롯에 "—" 노출.

type Props = {
  class: AssetClass;
  title: string;
  /** 자산군 인덱스 페이지 경로 (예: "/crypto"). */
  href: string;
  quotes: Quote[];
  /** 자산명 매핑 — registry 의 한글/영문명. */
  nameMap?: Record<string, {name: string; nameKo?: string}>;
  locale: string;
  /** 데이터 출처 라벨 (예: "Upbit KRW"). */
  sourceLabel: string;
  /** Demo 모드 배지 노출. */
  isDemo?: boolean;
  /** fetch 실패 메시지 (있을 때만). */
  fetchError?: string | null;
  /** 종목별 최근 7봉 close — top movers 행 옆에 sparkline. */
  sparklines?: Map<string, number[]>;
};

function priceFmt(currency: string): Intl.NumberFormat {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
    minimumFractionDigits: currency === "KRW" ? 0 : 2,
  });
}

function pickName(
  q: Quote,
  nameMap: Props["nameMap"],
  locale: string
): string {
  const meta = nameMap?.[q.symbol];
  if (!meta) return q.symbol.toUpperCase();
  return locale === "ko" && meta.nameKo ? meta.nameKo : meta.name;
}

export function AssetClassCard({
  class: cls,
  title,
  href,
  quotes,
  nameMap,
  locale,
  sourceLabel,
  isDemo,
  fetchError,
  sparklines,
}: Props) {
  const gainers = [...quotes]
    .sort((a, b) => b.changePct24h - a.changePct24h)
    .slice(0, 3);
  const losers = [...quotes]
    .sort((a, b) => a.changePct24h - b.changePct24h)
    .slice(0, 3);

  return (
    <article className="flex flex-col rounded-lg border border-line bg-bg p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-fg">
            <Link href={href} className="hover:text-accent">
              {title}
            </Link>
          </h2>
          <p className="mt-0.5 text-[11px] text-fg-subtle">{sourceLabel}</p>
        </div>
        {isDemo && (
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-fg-subtle">
            Demo
          </span>
        )}
      </header>

      {fetchError ? (
        <p className="text-xs text-fg-muted">데이터 fetch 실패 — {fetchError.slice(0, 60)}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <MoverList
            heading="Top gainers"
            quotes={gainers}
            cls={cls}
            nameMap={nameMap}
            locale={locale}
            sparklines={sparklines}
          />
          <MoverList
            heading="Top losers"
            quotes={losers}
            cls={cls}
            nameMap={nameMap}
            locale={locale}
            sparklines={sparklines}
          />
        </div>
      )}

      <footer className="mt-3 border-t border-line pt-3 text-right">
        <Link
          href={href}
          className="text-[11px] font-medium text-fg-muted transition-colors hover:text-fg"
        >
          {quotes.length}개 자산 전체 보기 →
        </Link>
      </footer>
    </article>
  );
}

function MoverList({
  heading,
  quotes,
  cls,
  nameMap,
  locale,
  sparklines,
}: {
  heading: string;
  quotes: Quote[];
  cls: AssetClass;
  nameMap: Props["nameMap"];
  locale: string;
  sparklines?: Map<string, number[]>;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {heading}
      </div>
      <ul className="flex flex-col gap-0.5">
        {quotes.length === 0 ? (
          <li className="px-2 py-1 text-xs text-fg-subtle">—</li>
        ) : (
          quotes.map((q) => {
            const spark = sparklines?.get(q.symbol);
            return (
              <li key={q.symbol}>
                <Link
                  href={`/${cls}/${q.symbol}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface"
                >
                  <span className="truncate font-medium text-fg">
                    {pickName(q, nameMap, locale)}
                    <span className="ml-1.5 text-fg-subtle">
                      {q.symbol.toUpperCase()}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {spark && spark.length >= 2 && (
                      <Sparkline
                        values={spark}
                        width={40}
                        height={16}
                        ariaLabel={`${q.symbol} 7일 추세`}
                        className="opacity-80"
                      />
                    )}
                    <span className="text-fg-muted">
                      {priceFmt(q.currency).format(q.price)}
                    </span>
                    <FinancialDelta changePct={q.changePct24h} digits={2} />
                  </span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
