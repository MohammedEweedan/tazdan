"use client";

/* Terms of service — approved page_terms_* copy, unchanged, in the legal
   reading layout. Anchor ids are stable across languages. */

import { useTranslate } from "@tolgee/react";
import { SiteShell } from "@/components/site";
import LegalDocument from "@/components/pages/legal/LegalDocument";

const SECTIONS = [
  { id: "acceptance", title: "page_terms_s1_t", body: "page_terms_s1_d" },
  { id: "eligibility", title: "page_terms_s2_t", body: "page_terms_s2_d" },
  { id: "account-security", title: "page_terms_s3_t", body: "page_terms_s3_d" },
  { id: "kyc-aml", title: "page_terms_s4_t", body: "page_terms_s4_d" },
  { id: "fees", title: "page_terms_s5_t", body: "page_terms_s5_d" },
  { id: "prohibited-activities", title: "page_terms_s6_t", body: "page_terms_s6_d" },
  { id: "risk-disclosure", title: "page_terms_s7_t", body: "page_terms_s7_d" },
  { id: "limitation-of-liability", title: "page_terms_s8_t", body: "page_terms_s8_d" },
  { id: "governing-law", title: "page_terms_s9_t", body: "page_terms_s9_d" },
  { id: "contact", title: "page_terms_s10_t", body: "page_terms_s10_d" },
] as const;

function TermsDocument() {
  const { t } = useTranslate();
  return (
    <LegalDocument
      eyebrow={t("page_terms_title")}
      title={t("legal.terms.hero.title")}
      intro={t("page_terms_intro")}
      updated={t("page_terms_updated")}
      sections={SECTIONS.map((s) => ({ id: s.id, title: t(s.title), body: t(s.body) }))}
    />
  );
}

export default function TermsPage() {
  return (
    <SiteShell>
      <TermsDocument />
    </SiteShell>
  );
}
