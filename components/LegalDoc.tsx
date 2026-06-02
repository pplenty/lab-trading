import type {ReactNode} from "react";
import {Link} from "@/i18n/navigation";

// 법적/정책 페이지 렌더러 — lib/legal/content.ts 의 경량 마크다운을 표시.
// 지원: ## / ### 제목, - 목록, **굵게**, `코드`, [텍스트](url), <url> 자동링크, > 인용, --- 구분선.
// 외부 의존 0 (Workers 호환). 정적 콘텐츠라 보안 이슈 없음.

const INLINE_RE =
  /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(<https?:\/\/[^>]+>)|(`[^`]+`)/g;

function renderInline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${kp}-b${i}`} className="font-semibold text-fg">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={`${kp}-c${i}`}
          className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] text-fg"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      if (mm) {
        const external = /^https?:\/\//.test(mm[2]);
        nodes.push(
          external ? (
            <a
              key={`${kp}-l${i}`}
              href={mm[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2 hover:opacity-80"
            >
              {mm[1]}
            </a>
          ) : (
            <Link
              key={`${kp}-l${i}`}
              href={mm[2]}
              className="text-accent underline underline-offset-2 hover:opacity-80"
            >
              {mm[1]}
            </Link>
          )
        );
      } else {
        nodes.push(tok);
      }
    } else {
      // <url>
      const url = tok.slice(1, -1);
      nodes.push(
        <a
          key={`${kp}-u${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-accent underline underline-offset-2 hover:opacity-80"
        >
          {url}
        </a>
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "") {
      i++;
      continue;
    }
    if (t === "---") {
      out.push(<hr key={key++} className="my-7 border-line" />);
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      out.push(
        <h3 key={key++} className="mt-6 text-sm font-semibold text-fg">
          {renderInline(t.slice(4), `h3-${key}`)}
        </h3>
      );
      i++;
      continue;
    }
    if (t.startsWith("## ")) {
      out.push(
        <h2 key={key++} className="mt-8 text-base font-semibold text-fg">
          {renderInline(t.slice(3), `h2-${key}`)}
        </h2>
      );
      i++;
      continue;
    }
    if (t.startsWith("> ")) {
      out.push(
        <blockquote
          key={key++}
          className="mt-3 border-l-2 border-line pl-3 text-fg-subtle"
        >
          {renderInline(t.slice(2), `q-${key}`)}
        </blockquote>
      );
      i++;
      continue;
    }
    if (t.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      out.push(
        <ul key={key++} className="mt-2 list-disc space-y-1.5 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }
    out.push(
      <p key={key++} className="mt-3 leading-relaxed">
        {renderInline(t, `p-${key}`)}
      </p>
    );
    i++;
  }
  return out;
}

export function LegalDoc({
  title,
  effectiveDate,
  content,
}: {
  title: string;
  effectiveDate?: string;
  content: string;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link
        href="/"
        className="text-xs text-fg-subtle transition-colors hover:text-fg"
      >
        ← 홈으로
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {title}
      </h1>
      {effectiveDate && (
        <p className="mt-1.5 text-xs text-fg-subtle">시행일: {effectiveDate}</p>
      )}
      <article className="mt-6 text-sm text-fg-muted">
        {renderMarkdown(content)}
      </article>
    </main>
  );
}
