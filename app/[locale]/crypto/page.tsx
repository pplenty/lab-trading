import {getTranslations} from "next-intl/server";
import {StubPage} from "@/components/StubPage";

export default async function CryptoIndexPage() {
  const t = await getTranslations("home");
  return <StubPage title={t("crypto")} phase="Phase 1" />;
}
