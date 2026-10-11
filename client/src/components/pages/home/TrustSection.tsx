"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAward, FiCreditCard, FiFileText, FiGlobe, FiLock, FiShield, FiUserCheck,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import {
  Body, Container, FeatureGrid, Footnote, Section, SectionHeader,
  SiteButton, useSiteTheme,
} from "@/components/site";

const FRAMEWORKS: { id: string; icon: IconType; status: "sc_fw_soc2_status" | "sc_fw_pci_status" | "sc_fw_iso_status" | "sc_fw_gdpr_status" | "sc_fw_aml_status" | "sc_fw_lic_status" }[] = [
  { id: "soc2", icon: FiShield, status: "sc_fw_soc2_status" },
  { id: "pci", icon: FiCreditCard, status: "sc_fw_pci_status" },
  { id: "iso", icon: FiAward, status: "sc_fw_iso_status" },
  { id: "gdpr", icon: FiLock, status: "sc_fw_gdpr_status" },
  { id: "aml", icon: FiUserCheck, status: "sc_fw_aml_status" },
  { id: "lic", icon: FiFileText, status: "sc_fw_lic_status" },
];

/** Product protections and the actual state of each external framework. */
export default function TrustSection() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  return (
    <Section id="security" rule>
      <Container>
        <SectionHeader eyebrow={t("sc_eyebrow")} title={t("sc_title")} lead={t("home.safety.lead")}
          actions={<SiteButton variant="link" href="/security" arrow>{t("sc_more")}</SiteButton>} />
        <Box mt="clamp(44px, 6vw, 82px)">
          <FeatureGrid items={[
            { icon: FiShield, title: t("home.safety.funds.title"), body: t("home.safety.funds.body"), href: "/security", linkLabel: t("sc_more") },
            { icon: FiLock, title: t("home.safety.privacy.title"), body: t("home.safety.privacy.body"), href: "/privacy", linkLabel: t("sc_more") },
            { icon: FiGlobe, title: t("home.safety.security.title"), body: t("home.safety.security.body"), href: "/trust", linkLabel: t("sc_more") },
          ]} />
        </Box>
        <Box as="ul" listStyleType="none" display="grid"
          gridTemplateColumns={{ base: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }}
          columnGap="clamp(18px, 4vw, 60px)" rowGap="clamp(42px, 6vw, 80px)"
          mt="clamp(88px, 10vw, 144px)" aria-label={t("sc_list_aria")}>
          {FRAMEWORKS.map(({ id, icon: Icon, status }) => {
            const nameKey = `sc_fw_${id}_name`;
            const detailKey = `sc_fw_${id}_d`;
            return (
            <Box as="li" key={id} borderTop="1px solid" borderColor={theme.divider} pt="24px">
              <Box color={theme.fg} mb="20px"><Icon size={48} strokeWidth={1.25} aria-hidden /></Box>
              <Box as="h3" fontSize={{ base: "17px", md: "20px" }} fontWeight={600} color={theme.fg}>
                {t(nameKey)}
              </Box>
              <Body mt="9px" fontSize="14.5px">{t(detailKey)}</Body>
              <Box mt="15px" display="inline-flex" alignItems="center" gap="8px" color={theme.accentText}
                fontSize="12.5px" fontWeight={600}>
                <Box w="7px" h="7px" borderRadius="full" bg={theme.accentText} />
                {t(status)}
              </Box>
            </Box>
          ); })}
        </Box>
        <Footnote mt="38px" maxW="80ch">{t("sc_fw_lic_body")}</Footnote>
      </Container>
    </Section>
  );
}
