"use client";

import { useTranslate } from "@tolgee/react";
import LegalPage from "@/components/ui/LegalPage";

export default function TermsPage() {
  const { t } = useTranslate();

  const sections = [
    { title: t("page_terms_s1_t"), body: t("page_terms_s1_d") },
    { title: t("page_terms_s2_t"), body: t("page_terms_s2_d") },
    { title: t("page_terms_s3_t"), body: t("page_terms_s3_d") },
    { title: t("page_terms_s4_t"), body: t("page_terms_s4_d") },
    { title: t("page_terms_s5_t"), body: t("page_terms_s5_d") },
    { title: t("page_terms_s6_t"), body: t("page_terms_s6_d") },
    { title: t("page_terms_s7_t"), body: t("page_terms_s7_d") },
    { title: t("page_terms_s8_t"), body: t("page_terms_s8_d") },
    { title: t("page_terms_s9_t"), body: t("page_terms_s9_d") },
    { title: t("page_terms_s10_t"), body: t("page_terms_s10_d") },
  ];

  return (
    <LegalPage
      eyebrow={t("page_terms_eyebrow")}
      title={t("page_terms_title")}
      updated={t("page_terms_updated")}
      intro={t("page_terms_intro")}
      sections={sections}
    />
  );
}
