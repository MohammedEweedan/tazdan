"use client";

/* Risk summary — the key risks first as plain-language bento tiles, then the
   approved full text (risk_* keys, unchanged) in the legal reading layout. */

import { useTranslate } from "@tolgee/react";
import { SiteShell } from "@/components/site";
import LegalDocument, { type LegalSectionData } from "@/components/pages/legal/LegalDocument";
import { InlineLink, LegalParagraph } from "@/components/pages/legal/LegalText";
import { AssetRiskList, KEY_RISKS, RiskGlance } from "@/components/pages/legal/RiskSummary";

function RiskDocument() {
  const { t } = useTranslate();

  const sections: LegalSectionData[] = [
    ...KEY_RISKS.map((r) => ({
      id: r.id,
      title: t(r.titleKey),
      body: (
        <>
          {r.bodyKeys.map((k) => (
            <LegalParagraph key={k}>{t(k)}</LegalParagraph>
          ))}
        </>
      ),
    })),
    {
      id: "asset-risks",
      title: t("risk_page_asset_risks_eyebrow"),
      body: (
        <>
          <LegalParagraph>{t("risk_page_asset_risks_sub")}</LegalParagraph>
          <AssetRiskList />
        </>
      ),
    },
    {
      id: "learn-more",
      title: t("legal.risk.more.title"),
      body: (
        <>
          <LegalParagraph>
            <InlineLink href="#asset-risks">{t("risk_page_footer_1")}</InlineLink>
          </LegalParagraph>
          <LegalParagraph>
            {t("risk_page_footer_2")}{" "}
            <InlineLink href="https://www.fca.org.uk" external>{t("risk_page_footer_fca_1")}</InlineLink>
            {t("risk_page_footer_join")}{" "}
            <InlineLink href="https://www.fca.org.uk/consumers/cryptoassets" external>{t("risk_page_footer_fca_2")}</InlineLink>
            .
          </LegalParagraph>
        </>
      ),
    },
  ];

  return (
    <LegalDocument
      eyebrow={t("risk_page_eyebrow")}
      title={t("legal.risk.hero.title")}
      intro={`${t("risk_banner_bold")} ${t("risk_banner_text")}`}
      updated={t("legal.risk.updated")}
      meta={[t("risk_page_reading_time")]}
      readLabel={t("legal.risk.hero.read")}
      readHref="#key-risks"
      before={<RiskGlance />}
      sections={sections}
    />
  );
}

export default function RiskPage() {
  return (
    <SiteShell>
      <RiskDocument />
    </SiteShell>
  );
}
