import {getTranslations} from "next-intl/server";
import {NewsList} from "@/components/panels/NewsList";

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CryptoNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="crypto" title={`${t("crypto")} 뉴스`} locale={locale} />;
}
