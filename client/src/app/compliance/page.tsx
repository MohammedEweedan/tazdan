"use client";

import { useTranslate } from "@tolgee/react";
import LegalPage from "@/components/ui/LegalPage";

export default function CompliancePage() {
  const { t } = useTranslate();

  const sections = [
    { title: t("page_compliance_s1_t"), body: t("page_compliance_s1_d") },
    { title: t("page_compliance_s2_t"), body: t("page_compliance_s2_d") },
    { title: t("page_compliance_s3_t"), body: t("page_compliance_s3_d") },
    { title: t("page_compliance_s4_t"), body: t("page_compliance_s4_d") },
    { title: t("page_compliance_s5_t"), body: t("page_compliance_s5_d") },
    { title: t("page_compliance_s6_t"), body: t("page_compliance_s6_d") },
    { title: t("page_compliance_s7_t"), body: t("page_compliance_s7_d") },
    { title: t("page_compliance_s8_t"), body: t("page_compliance_s8_d") },
  ];

  return (
    <LegalPage
      eyebrow={t("page_compliance_eyebrow")}
      title={t("page_compliance_title")}
      updated={t("page_compliance_updated")}
      intro={t("page_compliance_intro")}
      sections={sections}
    />
  );
}
