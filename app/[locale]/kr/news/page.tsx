import {getTranslations} from "next-intl/server";
import {NewsList} from "@/components/panels/NewsList";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KrNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="kr" title={`${t("kr").replace(" (Phase 1.5)", "")} 뉴스`} locale={locale} />;
}
