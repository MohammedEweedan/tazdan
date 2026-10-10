"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCreditCard, FiLink, FiSend, FiShield } from "react-icons/fi";
import {
  Body, Container, Eyebrow, Headline, Section, SiteButton, StatusChip, useSiteTheme,
} from "@/components/site";

export default function FeatureShowcase() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const tile = {
    border: "1px solid", borderColor: theme.border, borderRadius: "24px",
    bg: theme.bgElev, p: { base: "26px", md: "34px" },
  } as const;
  return (
    <Section id="showcase" rule>
      <Container>
        <Eyebrow mb="16px">{t("pb_eyebrow")}</Eyebrow>
        <Headline text={t("tz_bento_title_a") + " *" + t("tz_bento_title_b") + "*"} maxW="18ch" />
        <Box display="grid" gap="16px" mt="clamp(42px, 6vw, 82px)"
          gridTemplateColumns={{ base: "1fr", md: "repeat(6,minmax(0,1fr))" }}
          gridTemplateAreas={{ base: '"send" "card" "link" "secure"', md: '"send send send send card card" "send send send send card card" "link link link secure secure secure"' }}>
          <Box {...tile} gridArea="send" minH={{ md: "470px" }} display="flex" flexDirection="column">
            <Box color={theme.accentText} mb="20px"><FiSend size={28} /></Box>
            <StatusChip status="inApp" alignSelf="flex-start" />
            <Headline mt="16px" text={t("tz_bento_send_title")} size="sub" maxW="15ch" />
            <Body mt="12px" maxW="44ch">{t("home.everything.move.body")}</Body>
            <Box mt="auto" pt="32px" w="100%" aria-hidden>
              <svg viewBox="0 0 560 120" width="100%" height="120" preserveAspectRatio="none">
                <path d="M12 98 C155 14 358 14 548 94" stroke={theme.borderStrong} strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="98" r="5" fill={theme.accent} />
                <circle cx="548" cy="94" r="5" fill={theme.green} />
              </svg>
            </Box>
          </Box>
          <Box {...tile} gridArea="card" minH={{ md: "470px" }} display="flex" flexDirection="column">
            <Box display="flex" justifyContent="space-between" gap="10px"><FiCreditCard color={theme.accentText} size={27} /><StatusChip status="planned" /></Box>
            <Headline mt="24px" text={t("tz_bento_card_title")} size="item" />
            <Body mt="10px">{t("card_desc")}</Body>
            <Box mt="auto" pt="28px">
              <Box borderRadius="18px" h="150px" p="22px" color="#fff"
                bg="linear-gradient(135deg,#2A5A8B,#101C2A)" display="flex" flexDirection="column" justifyContent="space-between"
                boxShadow="0 18px 44px rgba(0,0,0,.2)">
                <Box fontSize="17px" fontWeight={700}>tazdan</Box>
                <Box fontSize="15px" letterSpacing="0.15em">••••&nbsp; ••••&nbsp; ••••&nbsp; 8240</Box>
              </Box>
            </Box>
          </Box>
          <Box {...tile} gridArea="link">
            <Box color={theme.accentText} mb="16px"><FiLink size={27} /></Box>
            <StatusChip status="inApp" />
            <Headline mt="16px" text={t("tz_bento_link_title")} size="item" />
            <Body mt="10px">{t("cl_sub")}</Body>
          </Box>
          <Box {...tile} gridArea="secure">
            <Box color={theme.accentText} mb="16px"><FiShield size={27} /></Box>
            <StatusChip status="inApp" />
            <Headline mt="16px" text={t("tz_bento_secure_title")} size="item" />
            <Body mt="10px">{t("home.safety.lead")}</Body>
            <Box mt="20px"><SiteButton variant="link" href="/security" arrow>{t("sc_more")}</SiteButton></Box>
          </Box>
        </Box>
      </Container>
    </Section>
  );
}
