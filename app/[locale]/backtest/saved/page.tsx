import {getTranslations} from "next-intl/server";
import {SavedStrategiesPanel} from "@/components/panels/SavedStrategiesPanel";

export const dynamic = "force-static";

export default async function BacktestSavedPage() {
  const t = await getTranslations("home");
  const tDisc = await getTranslations("disclaimer");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-fg-subtle">
          {t("backtest")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          저장된 전략
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          백테스트 작업장에서 저장한 (전략 + 파라미터 + 종목) 조합. localStorage 단독 (ADR-0016) — 디바이스 간 동기 X.
        </p>
      </header>

      <SavedStrategiesPanel />

      <footer className="mt-10 border-t border-line pt-4 text-xs text-fg-subtle">
        <p>{tDisc("general")}</p>
        <p className="mt-1">{tDisc("backtest")}</p>
      </footer>
    </main>
  );
}
