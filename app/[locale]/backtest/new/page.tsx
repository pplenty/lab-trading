import {getTranslations} from "next-intl/server";
import {StubPage} from "@/components/StubPage";

export default async function BacktestNewPage() {
  const t = await getTranslations("home");
  return <StubPage title={t("backtest")} phase="Phase 1" />;
}
