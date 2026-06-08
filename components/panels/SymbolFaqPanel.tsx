import type {AssetClass} from "@/lib/types";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import {D1CandleRepo} from "@/lib/db/d1/repos";
import {getSector} from "@/lib/symbols/sectors";
import {getSymbolDesc} from "@/lib/symbols/descriptions";
import {buildSymbolFaq, faqJsonLd, type FaqItem} from "@/lib/symbols/faq";

// 종목 상세 "자주 묻는 질문" 패널 — D1 파생 고유 Q&A (검색 진입 콘텐츠 깊이).
// ReturnsPanel/PriceLevelsPanel 과 동일 RSC + D1 range 패턴. 외부 fetch 0.
// <details> 네이티브 disclosure — 접혀 있어도 본문은 DOM 에 있어 색인됨.

const DAY_SEC = 86400;

type Props = {
  class: AssetClass;
  symbol: string;
  displayName: string;
  label: string; // BTC / AAPL / 005930
  market?: string | null;
};

function findBaselineAtOrBefore(
  candles: Array<{t: number; c: number}>,
  targetT: number
): number | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].t <= targetT) return candles[i].c;
  }
  return null;
}

async function loadFaqMetrics(symbol: string): Promise<{
  asOf: number;
  current: number;
  changePct: number | null;
  high52: number | null;
  low52: number | null;
  ret1m: number | null;
  ret3m: number | null;
  ret1y: number | null;
} | null> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const repo = new D1CandleRepo(db);
    const now = Math.floor(Date.now() / 1000);
    // 최근 ~405일 (1년 수익률 baseline + 휴장 여유). ReturnsPanel(250봉)과 유사 부하.
    const candles = await repo.range({
      symbol,
      from: now - 405 * DAY_SEC,
      to: now + DAY_SEC,
    });
    if (candles.length < 2) return null;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const changePct =
      prev && prev.c !== 0 ? ((last.c - prev.c) / prev.c) * 100 : null;

    // 52주(365일) 창 종가 고저
    const yearAgoT = last.t - 365 * DAY_SEC;
    const closes = candles.filter((c) => c.t >= yearAgoT).map((c) => c.c);
    const high52 = closes.length > 0 ? Math.max(...closes) : null;
    const low52 = closes.length > 0 ? Math.min(...closes) : null;

    const ret = (days: number): number | null => {
      const base = findBaselineAtOrBefore(candles, last.t - days * DAY_SEC);
      return base && base !== 0 ? ((last.c - base) / base) * 100 : null;
    };

    return {
      asOf: last.t,
      current: last.c,
      changePct,
      high52,
      low52,
      ret1m: ret(31),
      ret3m: ret(93),
      ret1y: ret(365),
    };
  } catch {
    return null;
  }
}

export async function SymbolFaqPanel({
  class: cls,
  symbol,
  displayName,
  label,
  market,
}: Props) {
  const m = await loadFaqMetrics(symbol);
  // 데이터가 없으면 (LTC 등 미백필 종목) 패널 자체를 렌더하지 않음 — thin content 회피.
  if (!m) return null;

  const items: FaqItem[] = buildSymbolFaq({
    cls,
    displayName,
    label,
    market: market ?? null,
    sector: getSector(cls, symbol),
    desc: getSymbolDesc(symbol) ?? null,
    asOf: m.asOf,
    current: m.current,
    changePct: m.changePct,
    high52: m.high52,
    low52: m.low52,
    ret1m: m.ret1m,
    ret3m: m.ret3m,
    ret1y: m.ret1y,
  });

  if (items.length === 0) return null;

  return (
    <section className="mt-6 mb-6">
      <header className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-fg-muted">
          자주 묻는 질문
        </h2>
      </header>
      <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface/30">
        {items.map((it, i) => (
          <details key={i} open={i === 0} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-fg marker:content-['']">
              <span>{it.q}</span>
              <span
                aria-hidden
                className="shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{it.a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: faqJsonLd(items)}}
      />
    </section>
  );
}
