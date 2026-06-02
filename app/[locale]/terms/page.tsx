import type {Metadata} from "next";
import {LegalDoc} from "@/components/LegalDoc";
import {LEGAL_EFFECTIVE_DATE, TERMS_MD} from "@/lib/legal/content";
import {absoluteUrl} from "@/lib/site";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "lab-trading 이용약관 — 서비스 정의(정보 제공 전용), 투자 권유·자문 아님, 데이터·백테스트 면책, 책임 제한, 준거법.",
  alternates: {canonical: absoluteUrl("/ko/terms")},
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="이용약관"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      content={TERMS_MD}
    />
  );
}
