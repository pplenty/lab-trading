import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {sql} from "drizzle-orm";
import {Link} from "@/i18n/navigation";
import {absoluteUrl} from "@/lib/site";
import {getDb, isDbAvailable} from "@/lib/db/d1/client";
import * as schema from "@/lib/db/d1/schema";
import {
  cryptoRegistry,
  krRegistry,
  usRegistry,
} from "@/lib/symbols/registry";
import {strategies} from "@/lib/backtest/strategies/registry";
import {faqJsonLd, type FaqItem} from "@/lib/symbols/faq";

// 백테스트 허브 — `/ko/backtest` 랜딩.
//
// 의도 (검색 진입): "국내주식 백테스트" / "해외주식 백테스트" / "코인 백테스트" 계열 쿼리는
// 네이버 실측 CTR 이 25~100% 로 사이트 전체 평균(0.2%)의 100배인데, 정작 이를 받는
// 페이지가 없어 `/ko/backtest` 가 404 였다 (하위 /new /custom /vs /portfolio /saved 만 존재).
// 자산군·전략·강건성 진단을 한 화면에 펼쳐 그 쿼리의 착지점을 만든다.
//
// 비용: D1 은 MIN/MAX(t) 단일 인덱스 조회 1회뿐 (COUNT(*) full scan 금지 — 142k rows read).
// 종목 수는 registry 파생(쿼리 0). revalidate 1h — 내용이 거의 정적.

const OG_BACKTEST = absoluteUrl("/og/backtest.png");

export const metadata: Metadata = {
  title: "백테스트 — 국내주식 · 해외주식 · 코인 일봉 전략 검증",
  description:
    "국내주식(KOSPI·KOSDAQ) · 해외주식 · 코인 112 종목을 같은 화면에서 일봉 백테스트. 8 전략 프리셋 + 커스텀 AND/OR 조건, 총수익률 · CAGR · MDD · 샤프지수 · Profit Factor. 회원가입 없이 무료.",
  alternates: {canonical: absoluteUrl("/ko/backtest")},
  openGraph: {
    title: "백테스트 — 국내주식 · 해외주식 · 코인 일봉 전략 검증",
    description:
      "112 종목 · 5년치 일봉 · 8 전략 프리셋. 수익률 · MDD · 샤프지수를 즉시 확인.",
    url: absoluteUrl("/ko/backtest"),
    siteName: "trading",
    locale: "ko",
    type: "website",
    images: [
      {url: OG_BACKTEST, width: 1200, height: 630, alt: "일봉 백테스트"},
    ],
  },
  twitter: {card: "summary_large_image", images: [OG_BACKTEST]},
};

// 내용이 거의 정적 (종목 수 + 데이터 범위) — 1h ISR 로 CPU · D1 최소화.
export const revalidate = 3600;

type Coverage = {first: number; latest: number} | null;

/** 데이터 범위 — MIN/MAX(t) 는 candles_t_idx 인덱스 조회라 full scan 이 아니다. */
async function loadCoverage(): Promise<Coverage> {
  if (!(await isDbAvailable())) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select({
        first: sql<number | null>`(SELECT MIN(t) FROM candles)`,
        latest: sql<number | null>`(SELECT MAX(t) FROM candles)`,
      })
      .from(schema.candles)
      .limit(1);
    const first = rows[0]?.first ?? null;
    const latest = rows[0]?.latest ?? null;
    return first && latest ? {first, latest} : null;
  } catch {
    return null;
  }
}

function ymd(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}

const ASSET_CARDS = [
  {
    cls: "kr" as const,
    label: "국내주식",
    keyword: "국내주식 백테스트",
    detail: "KOSPI · KOSDAQ 대형주 + KODEX 200 ETF",
    source: "KIS Open API · KRW",
    count: krRegistry.length,
    picks: [
      {symbol: "005930", name: "삼성전자"},
      {symbol: "000660", name: "SK하이닉스"},
      {symbol: "035420", name: "NAVER"},
      {symbol: "069500", name: "KODEX 200"},
    ],
  },
  {
    cls: "us" as const,
    label: "해외주식",
    keyword: "해외주식 백테스트",
    detail: "미국 나스닥 · NYSE 대표 종목",
    source: "Twelve Data · USD",
    count: usRegistry.length,
    picks: [
      {symbol: "aapl", name: "애플"},
      {symbol: "nvda", name: "엔비디아"},
      {symbol: "tsla", name: "테슬라"},
      {symbol: "msft", name: "마이크로소프트"},
    ],
  },
  {
    cls: "crypto" as const,
    label: "코인",
    keyword: "코인 백테스트",
    detail: "업비트 KRW 마켓 주요 코인",
    source: "Upbit · CoinGecko · KRW",
    count: cryptoRegistry.length,
    picks: [
      {symbol: "btc", name: "비트코인"},
      {symbol: "eth", name: "이더리움"},
      {symbol: "xrp", name: "리플"},
      {symbol: "sol", name: "솔라나"},
    ],
  },
];

// 강건성 3축 (파라미터 · 미래 · 비용) — 결과 아래 자동 표시되는 진단 패널 소개.
const ROBUSTNESS = [
  {
    title: "파라미터 민감도",
    body: "고른 값이 우연히 좋은 한 점인지 검사합니다. 파라미터를 격자로 훑어 수익률이 봉우리 하나에만 걸쳐 있으면 과최적화 신호입니다.",
  },
  {
    title: "워크포워드 (미래 일반화)",
    body: "앞 70% 기간에서 최적 파라미터를 고르고 뒤 30% 기간에 그대로 적용합니다. 과거에만 잘 맞는 전략을 걸러냅니다.",
  },
  {
    title: "거래비용 민감도",
    body: "수수료·슬리피지를 0배부터 3배까지 바꿔 다시 돌립니다. 단순 보유 대비 우위가 어느 비용 수준까지 살아남는지 봅니다.",
  },
];

const TOOLS = [
  {
    href: "/backtest/new",
    title: "새 전략 실행",
    body: "종목과 전략 프리셋을 고르고 파라미터를 슬라이더로 조정합니다.",
  },
  {
    href: "/backtest/custom",
    title: "커스텀 조건 빌더",
    body: "프리셋이 모자라면 지표·비교연산자를 AND/OR 로 묶어 직접 조건을 만듭니다.",
  },
  {
    href: "/backtest/vs",
    title: "전략 비교",
    body: "같은 종목·같은 기간에 두 전략을 나란히 돌려 수익률 곡선을 겹쳐 봅니다.",
  },
  {
    href: "/backtest/portfolio",
    title: "포트폴리오 백테스트",
    body: "여러 종목에 비중을 나눠 담고 정기 리밸런싱까지 반영합니다.",
  },
];

function buildFaq(coverage: Coverage, totalSymbols: number): FaqItem[] {
  const range = coverage
    ? `${ymd(coverage.first)}부터 ${ymd(coverage.latest)}까지`
    : "약 5년치";
  return [
    {
      q: "국내주식도 백테스트할 수 있나요?",
      a: `네. KOSPI·KOSDAQ 상장 ${krRegistry.length}개 종목(삼성전자·SK하이닉스·NAVER·KODEX 200 등)을 일봉 기준으로 백테스트할 수 있습니다. 해외주식 ${usRegistry.length}개, 코인 ${cryptoRegistry.length}개까지 합쳐 총 ${totalSymbols}개 종목을 같은 화면·같은 지표로 비교합니다.`,
    },
    {
      q: "백테스트 데이터는 어느 기간까지 있나요?",
      a: `모든 종목의 일봉을 ${range} 보관하고 있으며, 매일 자동으로 최신 봉을 추가합니다. 주봉·월봉으로 바꿔서 돌릴 수도 있습니다.`,
    },
    {
      q: "수수료와 슬리피지는 반영되나요?",
      a: "네. 기본값은 수수료 0.1%, 슬리피지 0.05%이며 체결마다 차감됩니다. 결과 아래 거래비용 민감도 패널에서 이 비용을 0배~3배로 바꿔가며 전략의 우위가 얼마나 견디는지 확인할 수 있습니다.",
    },
    {
      q: "어떤 전략을 쓸 수 있나요?",
      a: `기본 제공 프리셋은 ${strategies.length}가지입니다 — ${strategies
        .map((s) => s.nameKo)
        .join(" · ")}. 프리셋으로 부족하면 커스텀 빌더에서 지표 조건을 AND/OR 로 직접 조합할 수 있습니다.`,
    },
    {
      q: "분봉이나 실시간 자동매매도 되나요?",
      a: "아니요. 이 사이트는 일봉(및 주봉·월봉) 백테스트 전용이며, 분봉·초봉 데이터와 자동매매·주문 실행은 제공하지 않습니다. 정보 제공과 전략 검증만 다룹니다.",
    },
    {
      q: "회원가입이나 결제가 필요한가요?",
      a: "필요 없습니다. 로그인 없이 무료로 사용할 수 있고, 즐겨찾기·저장한 전략은 브라우저 안(localStorage)에만 저장되어 서버로 전송되지 않습니다.",
    },
  ];
}

export default async function BacktestHubPage() {
  const tDisc = await getTranslations("disclaimer");
  const coverage = await loadCoverage();
  const totalSymbols =
    cryptoRegistry.length + usRegistry.length + krRegistry.length;
  const faq = buildFaq(coverage, totalSymbols);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: faqJsonLd(faq)}}
      />

      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          백테스트 랩
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          국내주식 · 해외주식 · 코인 백테스트
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-fg-muted">
          KOSPI·KOSDAQ 종목도, 미국 주식도, 코인도 <strong>같은 화면 같은 지표</strong>로
          검증합니다. 종목과 전략을 고르면 총수익률 · CAGR · MDD(최대 낙폭) · 샤프지수 ·
          Profit Factor · 승률이 바로 나오고, 단순 보유 대비 우위까지 한 줄로 정리됩니다.
          {coverage ? (
            <>
              {" "}현재 <strong>{totalSymbols}개 종목</strong>의 일봉을{" "}
              {ymd(coverage.first)} ~ {ymd(coverage.latest)} 구간으로 보관 중입니다.
            </>
          ) : (
            <> 현재 <strong>{totalSymbols}개 종목</strong>의 일봉을 보관 중입니다.</>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/backtest/new?asset=kr&symbol=005930"
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg hover:border-fg-subtle"
          >
            국내주식으로 시작 →
          </Link>
          <Link
            href="/backtest/new?asset=us&symbol=aapl"
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg hover:border-fg-subtle"
          >
            해외주식으로 시작 →
          </Link>
          <Link
            href="/backtest/new?asset=crypto&symbol=btc"
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-fg hover:border-fg-subtle"
          >
            코인으로 시작 →
          </Link>
        </div>
      </header>

      {/* 자산군별 진입 */}
      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-fg">
          자산군별 백테스트
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSET_CARDS.map((card) => (
            <div
              key={card.cls}
              className="rounded-lg border border-line bg-surface/30 p-4"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-fg">
                  {card.keyword}
                </h3>
                <span className="text-xs text-fg-subtle">
                  {card.count}종목
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {card.detail}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {card.picks.map((p) => (
                  <li key={p.symbol}>
                    <Link
                      href={`/backtest/new?asset=${card.cls}&symbol=${p.symbol}`}
                      className="inline-block rounded border border-line px-2 py-1 text-xs text-fg-muted hover:border-fg-subtle hover:text-fg"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-fg-subtle">
                데이터 · {card.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 전략 프리셋 */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold text-fg">
          전략 프리셋 {strategies.length}가지
        </h2>
        <p className="mb-3 text-xs text-fg-muted">
          추세추종 · 평균회귀 · 단순 보유 baseline. 클릭하면 해당 전략으로 바로 실행됩니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {strategies.map((s) => (
            <Link
              key={s.id}
              href={`/backtest/new?asset=crypto&symbol=btc&strategy=${s.id}`}
              className="rounded-lg border border-line bg-surface/30 p-3 hover:border-fg-subtle"
            >
              <h3 className="text-sm font-semibold text-fg">{s.nameKo}</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {s.descriptionKo}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* 강건성 3축 */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold text-fg">
          결과를 믿어도 되는지까지 진단합니다
        </h2>
        <p className="mb-3 max-w-3xl text-xs leading-relaxed text-fg-muted">
          수익률 하나만 보면 과최적화·행운·비현실적 가정을 걸러낼 수 없습니다. 백테스트를
          돌리면 아래 세 진단이 결과 아래에 함께 표시됩니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {ROBUSTNESS.map((r) => (
            <div
              key={r.title}
              className="rounded-lg border border-line bg-surface/30 p-4"
            >
              <h3 className="text-sm font-semibold text-fg">{r.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 도구 */}
      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-fg">백테스트 도구</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg border border-line bg-surface/30 p-4 hover:border-fg-subtle"
            >
              <h3 className="text-sm font-semibold text-fg">{t.title} →</h3>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                {t.body}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-fg">자주 묻는 질문</h2>
        <dl className="divide-y divide-line rounded-lg border border-line bg-surface/30">
          {faq.map((item) => (
            <div key={item.q} className="p-4">
              <dt className="text-sm font-semibold text-fg">{item.q}</dt>
              <dd className="mt-1 text-xs leading-relaxed text-fg-muted">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="text-[11px] leading-relaxed text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
      </footer>
    </main>
  );
}
