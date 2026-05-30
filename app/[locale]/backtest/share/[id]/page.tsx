import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {loadShare} from "@/lib/share/backtest";
import {BacktestResultCard} from "@/components/panels/BacktestResultCard";
import {getStrategy} from "@/lib/backtest/strategies/registry";

// 공유 받은 백테스트 결과 — KV 에서 로드 후 정적으로 표시.
// 결과 + candles 가 fix → 시점 변동 무관.

export const dynamic = "force-dynamic";

const TF_LABEL: Record<string, string> = {
  "1d": "일봉",
  "1w": "주봉",
  "1mo": "월봉",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}): Promise<Metadata> {
  const {id} = await params;
  const data = await loadShare(id);
  if (!data) return {title: "공유된 백테스트 — 찾을 수 없음"};
  const strategy = getStrategy(data.strategyId);
  const title = `${data.displayName} ${strategy?.nameKo ?? data.strategyId} 백테스트`;
  const r = data.result.metrics;
  const description =
    `${data.displayName} (${data.displayTicker}) ${TF_LABEL[data.tf] ?? data.tf} ` +
    `${strategy?.nameKo ?? data.strategyId} 백테스트 결과 — ` +
    `수익률 ${r.totalReturnPct > 0 ? "+" : ""}${r.totalReturnPct.toFixed(2)}% / ` +
    `MDD -${r.mddPct.toFixed(2)}% / Sharpe ${r.sharpe.toFixed(2)}.`;
  return {
    title,
    description,
    robots: {index: false}, // 공유 링크는 검색 인덱스 X
  };
}

type Props = {
  params: Promise<{locale: string; id: string}>;
};

export default async function SharedBacktestPage({params}: Props) {
  const {id} = await params;
  const data = await loadShare(id);
  if (!data) notFound();

  const tDisc = await getTranslations("disclaimer");
  const strategy = getStrategy(data.strategyId);
  const r = data.result.metrics;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs text-fg-subtle">
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 uppercase tracking-wider">
            공유 백테스트
          </span>
          <span>id: {id}</span>
          <span>·</span>
          <span>{new Date(data.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          <Link
            href={`/${data.asset}/${data.symbol}`}
            className="hover:text-accent"
          >
            {data.displayName}
          </Link>{" "}
          <span className="text-fg-subtle">({data.displayTicker})</span>{" "}
          · {TF_LABEL[data.tf] ?? data.tf} {strategy?.nameKo ?? data.strategyId}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {strategy?.descriptionKo ?? data.strategyId} · 초기 자본{" "}
          {data.currency === "USD"
            ? `$${data.initialCapital.toLocaleString()}`
            : `₩${data.initialCapital.toLocaleString("ko-KR")}`}
        </p>

        {data.note && (
          <p className="mt-3 rounded-md border border-line bg-surface/40 px-3 py-2 text-sm text-fg-muted">
            💬 {data.note}
          </p>
        )}

        {/* 파라미터 박스 */}
        {Object.keys(data.params).length > 0 && (
          <details className="mt-3 rounded-md border border-line bg-surface/40 px-3 py-2 text-xs">
            <summary className="cursor-pointer select-none text-fg-muted hover:text-fg">
              전략 파라미터 보기
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
              {Object.entries(data.params).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-fg-subtle">{k}</span>
                  <span className="tabular-nums text-fg">{v}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* 핵심 메트릭 요약 — 결과 카드 위에 한 줄 */}
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm">
          <Metric
            label="수익률"
            value={`${r.totalReturnPct > 0 ? "+" : ""}${r.totalReturnPct.toFixed(2)}%`}
            tone={r.totalReturnPct > 0 ? "up" : "down"}
          />
          <Metric label="CAGR" value={`${r.cagrPct.toFixed(2)}%`} />
          <Metric label="MDD" value={`-${r.mddPct.toFixed(2)}%`} tone="down" />
          <Metric label="Sharpe" value={r.sharpe.toFixed(2)} />
          <Metric label="거래" value={`${r.tradeCount}회`} />
        </div>
      </header>

      <BacktestResultCard
        result={data.result}
        initialCapital={data.initialCapital}
        currency={data.currency}
        candles={data.candles}
        exportName={`${data.symbol}-${data.strategyId}`}
      />

      <section className="mt-8 rounded-lg border border-line bg-surface/30 p-4">
        <p className="text-sm font-medium text-fg">이 전략 직접 돌려보기</p>
        <p className="mt-1 text-xs text-fg-muted">
          파라미터를 바꿔보거나 다른 종목으로 적용해보세요.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={buildBacktestUrl(data)}
            className="inline-flex items-center gap-2 rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
          >
            같은 설정으로 열기 →
          </Link>
          <Link
            href={`/${data.asset}/${data.symbol}`}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-bg px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-fg hover:text-fg"
          >
            {data.displayName} 종목 페이지
          </Link>
        </div>
      </section>

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
        <p className="mt-2">
          공유 링크는 생성 시점의 결과를 그대로 보여줍니다. 시점 fix · 90일 보존.
        </p>
      </footer>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <span
        className={
          "text-sm font-semibold tabular-nums " +
          (tone === "up"
            ? "text-[var(--color-up)]"
            : tone === "down"
            ? "text-[var(--color-down)]"
            : "text-fg")
        }
      >
        {value}
      </span>
    </div>
  );
}

function buildBacktestUrl(d: {
  asset: string;
  symbol: string;
  strategyId: string;
  tf: string;
  params: Record<string, number>;
}): "/backtest/new" | `/backtest/new?${string}` {
  const params = new URLSearchParams();
  params.set("asset", d.asset);
  params.set("symbol", d.symbol);
  params.set("strategy", d.strategyId);
  if (d.tf !== "1d") params.set("tf", d.tf);
  for (const [k, v] of Object.entries(d.params)) {
    params.set(k, String(v));
  }
  return `/backtest/new?${params.toString()}`;
}
