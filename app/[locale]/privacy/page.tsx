import type {Metadata} from "next";
import {LegalDoc} from "@/components/LegalDoc";
import {LEGAL_EFFECTIVE_DATE, PRIVACY_MD} from "@/lib/legal/content";
import {absoluteUrl} from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "lab-trading 개인정보처리방침 — 수집 항목, 쿠키·광고(Google AdSense/Analytics), 제3자 제공, 이용자 권리, 개인정보 보호책임자.",
  alternates: {canonical: absoluteUrl("/ko/privacy")},
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="개인정보처리방침"
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      content={PRIVACY_MD}
    />
  );
}
