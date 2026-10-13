"use client";

/* Privacy policy — approved page_privacy_* copy, unchanged, in the legal
   reading layout. Anchor ids are stable across languages. */

import { useTranslate } from "@tolgee/react";
import { SiteShell } from "@/components/site";
import LegalDocument from "@/components/pages/legal/LegalDocument";

const SECTIONS = [
  { id: "data-we-collect", title: "page_privacy_s1_t", body: "page_privacy_s1_d" },
  { id: "how-we-use-it", title: "page_privacy_s2_t", body: "page_privacy_s2_d" },
  { id: "who-we-share-with", title: "page_privacy_s3_t", body: "page_privacy_s3_d" },
  { id: "your-rights", title: "page_privacy_s4_t", body: "page_privacy_s4_d" },
  { id: "data-retention", title: "page_privacy_s5_t", body: "page_privacy_s5_d" },
  { id: "cookies", title: "page_privacy_s6_t", body: "page_privacy_s6_d" },
  { id: "security", title: "page_privacy_s7_t", body: "page_privacy_s7_d" },
] as const;

function PrivacyDocument() {
  const { t } = useTranslate();
  return (
    <LegalDocument
      eyebrow={t("page_privacy_title")}
      title={t("legal.privacy.hero.title")}
      intro={t("page_privacy_intro")}
      updated={t("page_privacy_updated")}
      sections={SECTIONS.map((s) => ({ id: s.id, title: t(s.title), body: t(s.body) }))}
    />
  );
}

export default function PrivacyPage() {
  return (
    <SiteShell>
      <PrivacyDocument />
    </SiteShell>
  );
}
