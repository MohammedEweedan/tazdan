"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiActivity, FiAlertCircle, FiEyeOff, FiFileText, FiKey, FiLock, FiShield } from "react-icons/fi";
import {
  Body, Container, CTABand, FeatureGrid, Footnote, PageHero, Row, RowList,
  Section, SectionHeader, SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";

function SecurityContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const safeguards = [
    { icon: FiActivity, title: t("trust_lead_t"), body: t("trust_lead_d") },
    { icon: FiKey, title: t("trust_g3_t"), body: t("trust_g3_d") },
    { icon: FiFileText, title: t("trust_g5_t"), body: t("trust_g5_d") },
    { icon: FiShield, title: t("trust_aml2_t"), body: t("trust_aml2_d") },
    { icon: FiEyeOff, title: t("scp_priv_t"), body: t("scp_priv_d") },
    { icon: FiLock, title: t("trust_g6_t"), body: t("trust_g6_d") },
  ];
  return <>
    <PageHero eyebrow={t("scp_eyebrow")} title={t("scp_title")} lead={t("scp_sub")} />
    <Section rule><Container>
      <SectionHeader eyebrow={t("scp_acct_t")} title={t("trust_guarantees_title")} lead={t("scp_acct_d")} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={safeguards} /></Box>
      <Box mt="32px"><SiteButton variant="link" href="/trust" arrow>{t("scp_acct_link")}</SiteButton></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("scp_ops_t")} title={t("scp_fw_t")} lead={t("scp_fw_d")} />
      <Body mt="26px" maxW="72ch">{t("scp_ops_d")}</Body>
      <Box mt="40px" borderTop="1px solid" borderColor={theme.border}>
        <RowList>
          <Row icon={FiAlertCircle} title="SOC 2 / ISO 27001" body={t("scp_gap_2")} />
          <Row icon={FiAlertCircle} title={t("trust_status_3_t")} body={t("trust_status_3_d")} />
          <Row icon={FiAlertCircle} title={t("trust_status_2_t")} body={t("trust_status_2_d")} />
          <Row icon={FiAlertCircle} title={t("trust_status_1_t")} body={t("trust_status_1_d")} />
        </RowList>
      </Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("scp_vuln_t")} title={t("scp_cta_t")} lead={t("scp_vuln_d")}
        actions={<SiteButton variant="link" href="mailto:security@tazdan.com" external arrow>security@tazdan.com</SiteButton>} />
      <Footnote mt="30px">{t("scp_cta_d")}</Footnote>
    </Container></Section>
    <CTABand />
  </>;
}

export default function SecurityPage() { return <SiteShell><SecurityContent /></SiteShell>; }
