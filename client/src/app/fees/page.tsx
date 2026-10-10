"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiCreditCard, FiInfo, FiList } from "react-icons/fi";
import {
  Container, CTABand, FeatureGrid, Footnote, PageHero, Row, RowList,
  Section, SectionHeader, SiteShell, Stat, useSiteTheme,
} from "@/components/site";

function FeesContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  return <>
    <PageHero eyebrow={t("page_fees_eyebrow")} title={t("page_fees_title")} lead={t("page_fees_sub")} />
    <Section rule><Container>
      <SectionHeader title={t("page_fees_title")} lead={t("page_fees_hl2_d")} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={[
        { icon: FiCreditCard, title: t("page_fees_hl1_t"), body: t("page_fees_hl1_d") },
        { icon: FiCheck, title: t("page_fees_hl2_t"), body: t("page_fees_hl2_d") },
        { icon: FiInfo, title: t("page_fees_hl3_t"), body: t("page_fees_hl3_d") },
      ]} /></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader title={t("page_fees_t1")} lead={t("page_fees_sub")} />
      <Box mt="36px" borderTop="1px solid" borderColor={theme.border}><RowList>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((i) => <Row key={i} icon={FiList}
          title={t(`page_fees_row${i}_s`)} body={t(`page_fees_row${i}_n`)}
          trailing={<Box fontWeight={600} color={theme.fg} textAlign="end">{t(`page_fees_row${i}_f`)}</Box>} />)}
      </RowList></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader title={t("page_fees_limits_title")} lead={t("page_fees_sub")} />
      <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3,1fr)" }} gap="24px" mt="42px">
        <Stat value={t("page_fees_limits_basic")} label={t("page_fees_limits_basic_d")} />
        <Stat value={t("page_fees_limits_verified")} label={t("page_fees_limits_verified_d")} />
        <Stat value={t("page_fees_limits_pro")} label={t("page_fees_limits_pro_d")} />
      </Box>
      <Footnote mt="28px">{t("page_fees_sub")}</Footnote>
    </Container></Section>
    <CTABand />
  </>;
}
export default function FeesPage() { return <SiteShell><FeesContent /></SiteShell>; }
