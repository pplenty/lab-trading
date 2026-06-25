import {FinancialDelta} from "@/components/FinancialDelta";
import type {WalkForwardResult} from "@/lib/backtest/walk-forward";

// Walk-forward 강건성 — IS(앞) 에서 최적화한 파라미터를 OOS(뒤) 에 적용한 성과 낙차.
// 파라미터 민감도 스윕(전체기간 한 점)이 못 보는 "미래 일반화"를 진단. render-only.
// a11y: 색만으로 의미전달 X — verdict 한국어 텍스트 + ▲▼/부호(FinancialDelta) 병기.

export function WalkForwardPanel({
  result,
  loading,
  insufficient,
  noTrades,
}: {
  result: WalkForwardResult | null;
  loading: boolean;
  insufficient: boolean;
  /** 학습 구간에서 어떤 파라미터도 거래 안 함 → 검증할 최적값 없음. */
  noTrades: boolean;
}) {
  if (!result && !loading && !insufficient && !noTrades) return null;

  return (
    <section className="rounded-lg border border-line bg-surface/30 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Walk-forward 강건성</h3>
        <span className="text-[10px] text-fg-subtle">
          과최적화 진단 · 앞 70% 학습 → 뒤 30% 검증
        </span>
      </header>

      {insufficient ? (
        <p className="py-2 text-xs text-fg-subtle">
          검증 구간을 나눌 봉이 부족합니다 (학습·검증 각 최소 30봉 필요).
        </p>
      ) : noTrades ? (
        <p className="py-2 text-xs text-fg-subtle">
          학습 구간에서 거래가 발생하지 않아 검증할 최적 파라미터가 없습니다.
        </p>
      ) : loading && !result ? (
        <p className="py-2 text-center text-xs text-fg-subtle">
          워크포워드 계산 중…
        </p>
      ) : result ? (
        <WalkForwardBody r={result} />
      ) : null}

      <p className="mt-3 text-[10px] leading-relaxed text-fg-subtle">
        다른 파라미터는 현재값으로 고정한 채, 학습 구간(앞 70%)에서 첫 번째 파라미터의
        최적값을 찾아 학습에 쓰지 않은 검증 구간(뒤 30%)에 그대로 적용한 결과입니다.
        검증 성과가 학습보다 크게 낮으면 과거에만 맞춘 과최적화 신호일 수 있습니다.
        과거 성과는 미래를 보장하지 않습니다.
      </p>
    </section>
  );
}

function WalkForwardBody({r}: {r: WalkForwardResult}) {
  const tone =
    r.verdict === "robust"
      ? "text-[var(--color-up)]"
      : r.verdict === "overfit-suspect"
      ? "text-[var(--color-down)]"
      : "text-fg-muted";
  const prefix =
    r.verdict === "robust" ? "▲ " : r.verdict === "overfit-suspect" ? "⚠ " : "";
  const verdictText =
    r.verdict === "robust"
      ? "강건 — 검증 구간에서도 성과 유지"
      : r.verdict === "overfit-suspect"
      ? "과최적화 의심 — 검증 구간에서 급락"
      : r.oosTrades === 0
      ? "판단 보류 — 검증 구간 거래 없음"
      : "판단 보류 — 낙차가 중간이거나 학습 성과가 미미";

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-fg-muted">
          최적{" "}
          <span className="font-medium text-fg">{r.paramLabel}</span>{" "}
          <span className="font-semibold tabular-nums text-fg">
            {r.isBestValue}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-fg-subtle">
          학습 <FinancialDelta changePct={r.isPct} />
          <span aria-hidden className="px-0.5">
            →
          </span>
          검증 <FinancialDelta changePct={r.oosPct} />
        </span>
      </div>
      <div className={`text-[11px] font-medium ${tone}`}>
        {prefix}
        {verdictText}
        <span className="ml-1 font-normal text-fg-subtle tabular-nums">
          (낙차 {r.degradationPp.toFixed(1)}%p · 학습 {r.isTrades}거래 / 검증{" "}
          {r.oosTrades}거래 · 검증 {r.oosBars}봉)
        </span>
      </div>
    </div>
  );
}
