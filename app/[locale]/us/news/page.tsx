import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {absoluteUrl} from "@/lib/site";
import {NewsList} from "@/components/panels/NewsList";

export const metadata: Metadata = {
  title: "해외주식 뉴스",
  description:
    "애플 · 엔비디아 · 테슬라 등 미국 증시 최신 헤드라인. 경제지 RSS 30분 갱신.",
  alternates: {canonical: absoluteUrl("/ko/us/news")},
};

type Props = {
  params: Promise<{locale: string}>;
};

export default async function UsNewsPage({params}: Props) {
  const {locale} = await params;
  const t = await getTranslations("home");
  return <NewsList class="us" title={`${t("us")} 뉴스`} locale={locale} />;
}
