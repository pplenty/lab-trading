import type {AssetClass} from "@/lib/types";
import {Link} from "@/i18n/navigation";
import type {NewsMention} from "@/lib/data/news-mentions";

// "뉴스 주목 종목" — 최근 뉴스에서 가장 많이 언급된 종목 랭킹 칩.
// 시세 랭킹(가격)과 다른 축: 뉴스 관심도(attention). /news 상단.
// asset 구분은 텍스트 라벨로 — 색 dot 은 컬러 시맨틱(up/down) 과 혼동되어 미사용.

type Props = {
  mentions: NewsMention[];
  nameOf: (asset: AssetClass, symbol: string) => string;
  assetLabels: Record<AssetClass, string>;
};

export function NewsMentionsPanel({mentions, nameOf, assetLabels}: Props) {
  if (mentions.length === 0) return null;
  const max = mentions[0].count || 1;

  return (
    <section aria-label="뉴스 주목 종목" className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
          뉴스 주목 종목
        </h2>
        <span className="text-[10px] text-fg-subtle">
          최근 헤드라인 언급 빈도
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {mentions.map((m, i) => (
          <Link
            key={`${m.asset}-${m.symbol}`}
            href={`/${m.asset}/${m.symbol}`}
            prefetch={false}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface/40 py-1 pl-2.5 pr-3 text-xs transition-colors hover:border-accent"
          >
            <span className="tabular-nums text-fg-subtle">{i + 1}</span>
            <span className="font-medium text-fg">
              {nameOf(m.asset, m.symbol)}
            </span>
            <span className="text-[10px] text-fg-subtle">
              {assetLabels[m.asset]}
            </span>
            <span className="tabular-nums font-medium text-accent">
              {m.count}건
            </span>
            {/* 언급 빈도 미니 바 */}
            <span
              aria-hidden
              className="h-1 w-6 overflow-hidden rounded-full bg-line"
            >
              <span
                className="block h-full bg-accent"
                style={{width: `${Math.round((m.count / max) * 100)}%`}}
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
