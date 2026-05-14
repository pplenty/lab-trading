import {getTranslations} from "next-intl/server";
import {StubPage} from "@/components/StubPage";

export default async function UsIndexPage() {
  const t = await getTranslations("home");
  return <StubPage title={t("us")} phase="Phase 1" />;
}
