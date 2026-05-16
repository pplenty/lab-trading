import {getTranslations} from "next-intl/server";
import {NewsList} from "@/components/panels/NewsList";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function UsNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="us" title={`${t("us")} 뉴스`} locale={locale} />;
}
