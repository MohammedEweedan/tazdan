"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiActivity, FiAlertCircle, FiFileText, FiLock, FiShield, FiSliders } from "react-icons/fi";
import {
  Body, Container, CTABand, FeatureGrid, PageHero, Row, RowList,
  Section, SectionHeader, SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";

function TrustContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const controls = [
    { icon: FiActivity, title: t("trust_lead_t"), body: t("trust_lead_d") },
    { icon: FiLock, title: t("trust_g3_t"), body: t("trust_g3_d") },
    { icon: FiSliders, title: t("trust_g4_t"), body: t("trust_g4_d") },
    { icon: FiFileText, title: t("trust_g5_t"), body: t("trust_g5_d") },
    { icon: FiShield, title: t("trust_aml1_t"), body: t("trust_aml1_d") },
    { icon: FiShield, title: t("trust_aml2_t"), body: t("trust_aml2_d") },
  ];
  return <>
    <PageHero eyebrow={t("trust_eyebrow")} title={t("trust_title")} lead={t("trust_sub")} />
    <Section rule><Container>
      <SectionHeader title={t("trust_guarantees_title")} lead={t("trust_guarantees_sub")} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={controls} /></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("trust_aml_tag")} title={t("trust_aml_title")} lead={t("trust_aml_sub")} />
      <Box mt="36px"><RowList>{[1, 2, 3, 4, 5, 6].map((i) => <Row key={i} title={t(`trust_aml${i}_t`)} body={t(`trust_aml${i}_d`)} />)}</RowList></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("trust_status_tag")} title={t("trust_status_title")} lead={t("trust_status_sub")} />
      <Box mt="36px"><RowList>{[1, 2, 3].map((i) => <Row key={i} icon={FiAlertCircle} title={t(`trust_status_${i}_t`)} body={t(`trust_status_${i}_d`)} />)}</RowList></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader title={t("trust_legal_title")} />
      <Box mt="36px" borderTop="1px solid" borderColor={theme.border}><RowList>{[1, 2, 3, 4, 5, 6, 7].map((i) => <Row key={i} title={String(i).padStart(2, "0")} body={t(`trust_legal${i}`)} />)}</RowList></Box>
      <Box mt="24px"><SiteButton variant="link" href="/risk" arrow>{t("common.footer.link.risk")}</SiteButton></Box>
    </Container></Section>
    <CTABand title={t("trust_cta_title")} lead={t("trust_cta_sub")} />
  </>;
}
export default function TrustPage() { return <SiteShell><TrustContent /></SiteShell>; }
