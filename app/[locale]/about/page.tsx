import type {Metadata} from "next";
import {LegalDoc} from "@/components/LegalDoc";
import {ABOUT_MD} from "@/lib/legal/content";
import {absoluteUrl} from "@/lib/site";

export const metadata: Metadata = {
  title: "소개 — lab-trading",
  description:
    "lab-trading 은 코인·해외주식·국내주식 시세·랭킹·뉴스를 한 화면에서 비교하고 일봉 백테스트까지 제공하는 통합 정보 사이트입니다. 데이터 출처·면책·연락 안내.",
  alternates: {canonical: absoluteUrl("/ko/about")},
};

export default function AboutPage() {
  return <LegalDoc title="lab-trading 소개" content={ABOUT_MD} />;
}
