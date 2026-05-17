import type {NewsArticleView} from "@/lib/data/news";

// 뉴스 카드 — 제목 + 요약 + 출처 + 시각 + 원문 링크. 한국 RSS 관행 안에서 안전한 노출.
// 카드 자체에 source 라벨 명시 (ADR-0017 — 데이터 출처 표기).
// target="_blank" + rel="noreferrer" — 원문은 매체 사이트로.

type Props = {
  article: NewsArticleView;
  locale: string;
};

const RTF = new Intl.RelativeTimeFormat("ko", {numeric: "auto"});

function relativeTime(ts: number, now: number): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const minute = 60;
  const hour = 3600;
  const day = 86400;
  if (abs < minute) return RTF.format(Math.round(diff), "second");
  if (abs < hour) return RTF.format(Math.round(diff / minute), "minute");
  if (abs < day) return RTF.format(Math.round(diff / hour), "hour");
  return RTF.format(Math.round(diff / day), "day");
}

export function NewsCard({article, locale}: Props) {
  const rel = relativeTime(article.publishedAt, article.loadedAt ?? article.publishedAt);
  const abs = new Date(article.publishedAt * 1000).toLocaleString(
    locale === "en" ? "en-US" : "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <article className="rounded-lg border border-line bg-surface/30 p-4 transition-colors hover:bg-surface/60">
      <a
        href={article.url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col gap-2"
      >
        <h3 className="text-sm font-medium text-fg group-hover:text-accent sm:text-base">
          {article.title}
        </h3>
        {article.summary && (
          <p className="line-clamp-2 text-xs text-fg-muted sm:text-sm">
            {article.summary}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
          <span className="rounded-sm border border-line/60 bg-bg/40 px-1.5 py-0.5 uppercase tracking-wide">
            {article.source}
          </span>
          <time dateTime={new Date(article.publishedAt * 1000).toISOString()} title={abs}>
            {rel}
          </time>
        </div>
      </a>
    </article>
  );
}
