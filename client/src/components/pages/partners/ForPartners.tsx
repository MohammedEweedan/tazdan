"use client";

/* ForPartners — two hairline lists side by side: who tazdan works with
   (sticky on desktop, with the contact action) and what a partner plugs
   into. Stacks on phones. */

import { Box } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { Row, RowList, SectionLabel, SiteButton, useSiteTheme } from "@/components/site";

export function ForPartners({
  whoLabel, who, bringLabel, bring, cta,
}: {
  whoLabel: string;
  who: { title: string; body: string }[];
  bringLabel: string;
  bring: { icon: IconType; title: string; body: string }[];
  cta: { label: string; href: string };
}) {
  const t = useSiteTheme();
  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,5fr) minmax(0,7fr)" }}
      gap="clamp(48px, 6vw, 96px)"
      alignItems="start"
    >
      <Box position={{ base: "static", lg: "sticky" }} top="112px">
        <SectionLabel pb="14px" borderBottom="1px solid" borderColor={t.divider}>{whoLabel}</SectionLabel>
        <RowList>
          {who.map((w) => (
            <Row key={w.title} title={w.title} body={w.body} py="16px" />
          ))}
        </RowList>
        <Box mt="28px">
          <SiteButton href={cta.href} arrow>{cta.label}</SiteButton>
        </Box>
      </Box>
      <Box>
        <SectionLabel pb="14px" borderBottom="1px solid" borderColor={t.divider}>{bringLabel}</SectionLabel>
        <RowList>
          {bring.map((b) => (
            <Row key={b.title} icon={b.icon} title={b.title} body={b.body} py="22px" />
          ))}
        </RowList>
      </Box>
    </Box>
  );
}
