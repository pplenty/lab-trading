import {getTranslations} from "next-intl/server";
import type {AssetClass} from "@/lib/types";
import {loadNewsByClass} from "@/lib/data/news";
import {NewsCard} from "./NewsCard";

// 자산군 × 뉴스 페이지 공용 컴포넌트.
// loadNewsByClass — KV hot cache 우선 → D1 fallback → 빈 배열.

type Props = {
  class: AssetClass;
  title: string;
  locale: string;
};

export async function NewsList({class: cls, title, locale}: Props) {
  const tDisc = await getTranslations("disclaimer");
  const {articles, source} = await loadNewsByClass(cls, 30);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {title}
        </h1>
        <span className="text-[11px] text-fg-subtle">
          {source === "kv" ? "fresh · KV cache" : source === "d1" ? "D1 archive" : "loading"}
        </span>
      </header>

      {articles.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface/40 p-6 text-sm text-fg-muted">
          <p>아직 수집된 뉴스가 없습니다.</p>
          <p className="mt-1 text-xs text-fg-subtle">
            매 30분 자동 갱신 (한경 · 매경 · 파이낸셜뉴스 · 토큰포스트). 첫 cron 가 곧 실행됩니다.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {articles.map((a) => (
            <li key={a.url}>
              <NewsCard article={a} locale={locale} />
            </li>
          ))}
        </ol>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">
          출처: 한국경제 · 매일경제 · 파이낸셜뉴스 · 토큰포스트. 원문은 각 매체 사이트로 연결.
        </p>
      </footer>
    </main>
  );
}
