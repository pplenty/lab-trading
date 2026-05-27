import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {absoluteUrl} from "@/lib/site";
import {NewsList} from "@/components/panels/NewsList";

export const metadata: Metadata = {
  title: "국내주식 뉴스",
  description:
    "삼성전자 · SK하이닉스 등 KOSPI · KOSDAQ 최신 헤드라인. 한경 · 매경 · 파이낸셜뉴스 RSS 30분 갱신.",
  alternates: {canonical: absoluteUrl("/ko/kr/news")},
};

type Props = {
  params: Promise<{locale: string}>;
};

export default async function KrNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="kr" title={`${t("kr").replace(" (Phase 1.5)", "")} 뉴스`} locale={locale} />;
}
