"use client";

/* Risk summary pieces: the key risks as a bento of plain-language summaries
   (each tile links to its full text below), and the asset-risk rows used in
   the full text. The summaries are a reading aid — the approved risk_* copy
   is what applies, and the page says so. */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import { FiClock, FiHexagon, FiLayers, FiPieChart, FiShieldOff, FiTrendingDown } from "react-icons/fi";
import {
  BentoCard, BentoGrid, Container, Section, SectionHeader, useSiteTheme,
} from "@/components/site";
import { LegalList, LegalNotice, useAutoDir } from "./LegalText";

export type KeyRisk = { id: string; titleKey: string; summaryKey: string; bodyKeys: string[]; icon: IconType };

/** Literal key lists (the i18n QA greps for them). */
export const KEY_RISKS: KeyRisk[] = [
  { id: "lose-everything", titleKey: "risk_s1_title", summaryKey: "legal.risk.s1.summary", bodyKeys: ["risk_s1_p1", "risk_s1_p2"], icon: FiTrendingDown },
  { id: "no-protection", titleKey: "risk_s2_title", summaryKey: "legal.risk.s2.summary", bodyKeys: ["risk_s2_p1", "risk_s2_p2"], icon: FiShieldOff },
  { id: "may-not-sell", titleKey: "risk_s3_title", summaryKey: "legal.risk.s3.summary", bodyKeys: ["risk_s3_p1", "risk_s3_p2"], icon: FiClock },
  { id: "complex", titleKey: "risk_s4_title", summaryKey: "legal.risk.s4.summary", bodyKeys: ["risk_s4_p1", "risk_s4_p2"], icon: FiLayers },
  { id: "diversify", titleKey: "risk_s5_title", summaryKey: "legal.risk.s5.summary", bodyKeys: ["risk_s5_p1", "risk_s5_p2"], icon: FiPieChart },
];

export const ASSET_RISKS = [
  { nameKey: "risk_a1_name", riskKeys: ["risk_a1_r1", "risk_a1_r2"] },
  { nameKey: "risk_a2_name", riskKeys: ["risk_a2_r1", "risk_a2_r2"] },
  { nameKey: "risk_a3_name", riskKeys: ["risk_a3_r1", "risk_a3_r2"] },
  { nameKey: "risk_a4_name", riskKeys: ["risk_a4_r1", "risk_a4_r2"] },
  { nameKey: "risk_a5_name", riskKeys: ["risk_a5_r1", "risk_a5_r2"] },
];

// Desktop spans out of 6: the headline risk gets the wide tile, then a row of three.
const SPANS = [4, 2, 2, 2, 2] as const;

/** The key risks at a glance — shown before the full text. */
export function RiskGlance() {
  const t = useSiteTheme();
  const dir = useAutoDir();
  const { t: tr } = useTranslate();
  return (
    <Section id="key-risks" tight borderTop="1px solid" borderColor={t.border}>
      <Container>
        <SectionHeader
          eyebrow={tr("legal.risk.glance.eyebrow")}
          title={tr("legal.risk.glance.title")}
          lead={tr("legal.risk.glance.lead")}
        />
        <LegalNotice mt="clamp(32px, 4vw, 48px)" maxW="72ch">
          {tr("risk_page_fca_warning")}
        </LegalNotice>
        <BentoGrid mt="clamp(32px, 4vw, 48px)" data-legal-noprint>
          {KEY_RISKS.map((r, i) => (
            <BentoCard
              key={r.id}
              span={SPANS[i]}
              icon={r.icon}
              size={i === 0 ? "sub" : "item"}
              title={tr(r.titleKey)}
              body={tr(r.summaryKey)}
              link={{ href: `#${r.id}`, label: tr("legal.risk.glance.read") }}
            />
          ))}
          <BentoCard
            span={6}
            icon={FiHexagon}
            title={tr("risk_page_asset_risks_eyebrow")}
            body={tr("risk_page_asset_risks_sub")}
            link={{ href: "#asset-risks", label: tr("legal.risk.glance.read") }}
            visual={
              <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexWrap="wrap" gap="8px">
                {ASSET_RISKS.map((a) => (
                  <Box
                    as="li"
                    key={a.nameKey}
                    px="12px"
                    py="6px"
                    borderRadius="999px"
                    border="1px solid"
                    borderColor={t.border}
                    fontSize="13.5px"
                    color={t.fgMuted}
                    dir={dir}
                  >
                    {tr(a.nameKey)}
                  </Box>
                ))}
              </Box>
            }
          />
        </BentoGrid>
      </Container>
    </Section>
  );
}

/** Asset risks in the full text: hairline rows, name beside its two risks. */
export function AssetRiskList() {
  const t = useSiteTheme();
  const dir = useAutoDir();
  const { t: tr } = useTranslate();
  return (
    <Box as="ul" listStyleType="none" m={0} mt="20px" p={0} borderBottom="1px solid" borderColor={t.border}>
      {ASSET_RISKS.map((a) => (
        <Box
          as="li"
          key={a.nameKey}
          borderTop="1px solid"
          borderColor={t.border}
          py="18px"
          display="grid"
          gridTemplateColumns={{ base: "minmax(0,1fr)", md: "minmax(0, 0.36fr) minmax(0, 0.64fr)" }}
          columnGap="24px"
          rowGap="8px"
        >
          <Box fontWeight={600} color={t.fg} lineHeight={1.45} dir={dir}>
            {tr(a.nameKey)}
          </Box>
          <LegalList fontSize="0.95em" items={a.riskKeys.map((k) => tr(k))} />
        </Box>
      ))}
    </Box>
  );
}
