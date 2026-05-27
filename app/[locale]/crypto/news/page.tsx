import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {absoluteUrl} from "@/lib/site";
import {NewsList} from "@/components/panels/NewsList";

export const metadata: Metadata = {
  title: "코인 뉴스",
  description:
    "비트코인 · 이더리움 등 암호화폐 최신 헤드라인. 토큰포스트 + 경제지 RSS 30분 갱신.",
  alternates: {canonical: absoluteUrl("/ko/crypto/news")},
};

type Props = {
  params: Promise<{locale: string}>;
};

export default async function CryptoNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="crypto" title={`${t("crypto")} 뉴스`} locale={locale} />;
}
