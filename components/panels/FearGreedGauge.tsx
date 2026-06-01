import type {FearGreedReading} from "@/lib/market/fear-greed";
import {buildGaugeInner, ZONE_COLORS} from "@/lib/market/gauge";

// 공포·탐욕 지수 게이지 카드 (RSC, 인라인 SVG — 추가 클라이언트 JS 0).
// 바늘 위치 + 큰 숫자 + zone 라벨이 의미를 전달 (색만으로 전달 X — convention I).
// 출처 표기는 ToS 의무 (alternative.me) — footer 에 항상 노출.

const MARKET_LABEL: Record<string, string> = {
  crypto: "코인",
  us: "미국 증시",
};

function trendArrow(value: number, prev: number | null | undefined): string {
  if (prev == null) return "";
  const d = value - prev;
  if (d > 0) return `▲ ${d}`;
  if (d < 0) return `▼ ${Math.abs(d)}`;
  return "= 0";
}

export function FearGreedGauge({
  reading,
}: {
  reading: FearGreedReading | null;
}) {
  if (!reading) {
    return (
      <article className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-line bg-surface/30 p-6 text-center">
        <p className="text-sm font-medium text-fg">공포·탐욕 지수</p>
        <p className="mt-2 text-xs text-fg-muted">
          데이터를 일시적으로 가져올 수 없습니다.
        </p>
      </article>
    );
  }

  const {value, zone, labelKo, market, source, updatedAt, isProxy, detail, prev, stale} =
    reading;
  const zoneColor = ZONE_COLORS[zone];
  const marketLabel = MARKET_LABEL[market] ?? market;

  // 게이지 SVG (viewBox 220×120). 바늘색은 currentColor → text-fg 로 테마 대응.
  // 값/라벨은 게이지 아래에 별도 배치 (바늘 허브와 겹침 회피).
  const gaugeInner = buildGaugeInner({
    cx: 110,
    cy: 110,
    r: 88,
    strokeWidth: 18,
    value,
    needleColor: "currentColor",
  });

  const updated = new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(updatedAt * 1000));

  const arrow = trendArrow(value, prev);

  return (
    <article className="flex flex-col rounded-lg border border-line bg-surface/30 p-5">
      <header className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">
          {marketLabel} 공포·탐욕 지수
        </h3>
        {isProxy && (
          <span
            className="rounded bg-surface px-1.5 py-0.5 text-[9px] font-medium text-fg-subtle"
            title="공식 지수가 아닌 VIX 변동성 기반 자체 산출 프록시"
          >
            프록시
          </span>
        )}
      </header>

      {/* 게이지 + 아래 숫자/라벨 */}
      <div className="mx-auto w-full max-w-[240px] text-fg">
        <svg
          viewBox="0 0 220 120"
          className="w-full"
          role="img"
          aria-label={`${marketLabel} 공포·탐욕 지수 ${value} — ${labelKo}`}
          dangerouslySetInnerHTML={{__html: gaugeInner}}
        />
        <div className="-mt-2 flex flex-col items-center">
          <span className="text-4xl font-bold tabular-nums leading-none text-fg">
            {value}
          </span>
          <span className="mt-1 text-sm font-semibold" style={{color: zoneColor}}>
            {labelKo}
          </span>
        </div>
      </div>

      {/* 의미 축 (색만으로 의미 전달 회피) */}
      <div className="mt-2 flex items-center justify-between px-1 text-[10px] font-medium text-fg-subtle">
        <span style={{color: ZONE_COLORS[0]}}>← 공포</span>
        <span className="tabular-nums">
          {arrow && <span className="text-fg-muted">전일 대비 {arrow}</span>}
        </span>
        <span style={{color: ZONE_COLORS[4]}}>탐욕 →</span>
      </div>

      {/* a11y / SEO 텍스트 요약 */}
      <dl className="sr-only">
        <dt>{marketLabel} 공포·탐욕 지수</dt>
        <dd>
          {value} / 100 — {labelKo}
          {detail ? ` (${detail})` : ""}
        </dd>
      </dl>

      {/* 출처 (ToS 의무) + 기준일 */}
      <footer className="mt-3 flex items-baseline justify-between border-t border-line pt-2 text-[10px] text-fg-subtle">
        <a
          href={reading.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-fg"
        >
          Data: {source}
        </a>
        <span className="tabular-nums">
          {stale && <span className="mr-1 text-fg-muted">캐시 ·</span>}
          {detail ? `${detail} · ` : ""}
          {updated} 기준
        </span>
      </footer>
    </article>
  );
}
