"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  Container, PageHero, Section, SiteButton, SiteShell, useSiteTheme,
} from "@/components/site";

function MissingContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  return <>
    <PageHero eyebrow={t("notfound_eyebrow")} title={t("notfound_title")}
      lead={t("notfound_sub")}
      actions={<>
        <SiteButton href="/" size="lg" arrow>{t("notfound_home")}</SiteButton>
        <SiteButton href="/contact" variant="secondary" size="lg">{t("notfound_contact")}</SiteButton>
      </>} />
    <Section rule tight><Container>
      <Box display="flex" gap="24px" flexWrap="wrap" justifyContent="center"
        fontSize="14px" color={theme.fgMuted}>
        <Box as="a" href="/features" _hover={{ color: theme.fg }}>{t("notfound_link_features")}</Box>
        <Box as="a" href="/fees" _hover={{ color: theme.fg }}>{t("notfound_link_fees")}</Box>
        <Box as="a" href="/faq" _hover={{ color: theme.fg }}>{t("notfound_link_help")}</Box>
        <Box as="a" href="/contact" _hover={{ color: theme.fg }}>{t("notfound_link_contact")}</Box>
      </Box>
    </Container></Section>
  </>;
}

export default function NotFound() { return <SiteShell><MissingContent /></SiteShell>; }
