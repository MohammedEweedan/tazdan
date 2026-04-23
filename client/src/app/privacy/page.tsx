"use client";

import { useTranslate } from "@tolgee/react";
import LegalPage from "@/components/ui/LegalPage";

export default function PrivacyPage() {
  const { t } = useTranslate();

  const sections = [
    { title: t("page_privacy_s1_t"), body: t("page_privacy_s1_d") },
    { title: t("page_privacy_s2_t"), body: t("page_privacy_s2_d") },
    { title: t("page_privacy_s3_t"), body: t("page_privacy_s3_d") },
    { title: t("page_privacy_s4_t"), body: t("page_privacy_s4_d") },
    { title: t("page_privacy_s5_t"), body: t("page_privacy_s5_d") },
    { title: t("page_privacy_s6_t"), body: t("page_privacy_s6_d") },
    { title: t("page_privacy_s7_t"), body: t("page_privacy_s7_d") },
  ];

  return (
    <LegalPage
      eyebrow={t("page_privacy_eyebrow")}
      title={t("page_privacy_title")}
      updated={t("page_privacy_updated")}
      intro={t("page_privacy_intro")}
      sections={sections}
    />
  );
}
