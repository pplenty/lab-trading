import {Link} from "@/i18n/navigation";
import type {AssetClass} from "@/lib/types";
import {loadNewsBySymbol} from "@/lib/data/news";
import {NewsCard} from "./NewsCard";

// 종목 상세 페이지의 "관련 뉴스" 섹션.
// SSR — RSC 가 D1 query 후 카드 렌더. 빈 결과면 섹션 자체 hide.
// 자산군 인덱스의 뉴스 페이지로 "더보기" 링크.

type Props = {
  class: AssetClass;
  symbol: string;
  locale: string;
  limit?: number;
};

export async function SymbolRelatedNews({
  class: cls,
  symbol,
  locale,
  limit = 5,
}: Props) {
  const articles = await loadNewsBySymbol(cls, symbol, limit);
  if (articles.length === 0) return null;

  const moreHref =
    cls === "crypto" ? "/crypto/news" : cls === "us" ? "/us/news" : "/kr/news";

  return (
    <section className="mt-8 mb-6">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          관련 뉴스
        </h2>
        <Link
          href={moreHref}
          className="text-[11px] text-fg-subtle transition-colors hover:text-fg"
        >
          더보기 →
        </Link>
      </header>
      <ol className="flex flex-col gap-2">
        {articles.map((a) => (
          <li key={a.url}>
            <NewsCard article={a} locale={locale} />
          </li>
        ))}
      </ol>
    </section>
  );
}
