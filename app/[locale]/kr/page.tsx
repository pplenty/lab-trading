import {getTranslations} from "next-intl/server";
import {StubPage} from "@/components/StubPage";

export default async function KrIndexPage() {
  const t = await getTranslations("home");
  return <StubPage title={t("kr")} phase="Phase 1.5" />;
}
