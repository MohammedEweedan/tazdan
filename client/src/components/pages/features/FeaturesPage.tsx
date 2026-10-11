"use client";

/* /features ("Personal") — every capability of the personal app, told area by
   area as pain → answer with the real screens, then the complete index with
   honest status chips. Business gets a short section that links to /business. */

import { useMemo } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  Container, Footnote, Headline, Lead, PageHero, PhoneStage, Section, SectionHeader, SiteButton,
  SiteShell, Stat, StatusChip, useSiteLocale, useSiteTheme, useWaitlist, type Status,
} from "@/components/site";
import { AREAS } from "./data";
import { AreaSection, SectionIndex, STICKY_OFFSET } from "./parts";

function Hero() {
  const { t } = useTranslate();
  const { open } = useWaitlist();
  return (
    <PageHero
      align="split"
      eyebrow={t("features.hero.eyebrow")}
      title={t("features.hero.title")}
      lead={t("features.hero.lead")}
      note={t("features.hero.note")}
      actions={
        <>
          <SiteButton size="lg" onClick={open} arrow>{t("features.hero.primary")}</SiteButton>
          <SiteButton size="lg" variant="secondary" href="#all">{t("features.hero.secondary")}</SiteButton>
        </>
      }
      visual={
        <Box position="relative" display="flex" flexDirection="column" alignItems="center" gap="20px">
          <PhoneStage
            items={[{ video: "tour-home", screen: "home", alt: t("features.hero.alt") }]}
            index={0}
            priority
            w="min(300px, 74vw)"
          />
          <Footnote align="center" maxW="34ch">{t("common.media.illustrative")}</Footnote>
        </Box>
      }
    />
  );
}

const STATUS_ORDER: Status[] = ["inApp", "pilot", "planned"];
const LEGEND: Record<string, string> = {
  inApp: "features.all.legend.inApp",
  pilot: "features.all.legend.pilot",
  planned: "features.all.legend.planned",
};
const COUNT_LABEL: Record<string, string> = {
  inApp: "features.all.count.inApp",
  pilot: "features.all.count.pilot",
  planned: "features.all.count.planned",
};

/** The "100 %" proof: every capability, grouped by area, with its chip. */
function CapabilityIndex() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { forward } = useSiteLocale();
  const counts = useMemo(() => {
    const all = AREAS.flatMap((a) => a.caps);
    return {
      total: all.length,
      inApp: all.filter((c) => c.status === "inApp").length,
      pilot: all.filter((c) => c.status === "pilot").length,
      planned: all.filter((c) => c.status === "planned").length,
    } as Record<string, number>;
  }, []);

  return (
    <Section id="all" rule sx={{ scrollMarginTop: `${STICKY_OFFSET - 1}px` }}>
      <Container>
        <SectionHeader
          eyebrow={tr("features.all.eyebrow")}
          title={tr("features.all.title")}
          lead={tr("features.all.lead")}
        />

        <Box
          mt="clamp(40px, 5vw, 64px)"
          display="grid"
          gridTemplateColumns={{ base: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" }}
          gap="clamp(20px, 3vw, 40px)"
        >
          <Stat value={counts.total} label={tr("features.all.count.total")} />
          {STATUS_ORDER.map((s) => <Stat key={s} value={counts[s]} label={tr(COUNT_LABEL[s])} />)}
        </Box>

        <Box mt="32px" as="dl" display="grid" gap="10px" aria-label={tr("features.all.legend.label")}>
          {STATUS_ORDER.map((s) => (
            <Box key={s} display="flex" alignItems="center" gap="12px" flexWrap="wrap">
              <Box as="dt" minW="112px"><StatusChip status={s} /></Box>
              <Box as="dd" color={t.fgMuted} fontSize="14.5px" lineHeight={1.5} flex="1" minW="200px">{tr(LEGEND[s])}</Box>
            </Box>
          ))}
        </Box>

        <Box
          mt="clamp(48px, 6vw, 80px)"
          sx={{ columnCount: { base: 1, md: 2, xl: 3 }, columnGap: "clamp(28px, 4vw, 56px)" }}
        >
          {AREAS.map((area) => (
            <Box key={area.id} mb="44px" sx={{ breakInside: "avoid" }}>
              <Box
                as="h3"
                display="flex"
                alignItems="baseline"
                justifyContent="space-between"
                gap="12px"
                pb="12px"
                borderBottom="1px solid"
                borderColor={t.fg}
              >
                <Box
                  as="a"
                  href={`#${area.id}`}
                  fontSize="17px"
                  fontWeight={600}
                  color={t.fg}
                  title={tr("features.all.jump")}
                  _hover={{ color: t.accentText }}
                  _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px", borderRadius: "4px" }}
                >
                  {tr(area.nav)}
                  <Box as="span" aria-hidden sx={{ marginInlineStart: "8px" }} color={t.accentText} fontWeight={400}>{forward}</Box>
                </Box>
                <Box as="span" fontSize="13px" color={t.fgFaint} sx={{ fontVariantNumeric: "tabular-nums" }}>{area.caps.length}</Box>
              </Box>
              <Box as="ul" listStyleType="none">
                {area.caps.map((c) => (
                  <Box
                    as="li"
                    key={c.title}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="14px"
                    minH="46px"
                    py="9px"
                    borderBottom="1px solid"
                    borderColor={t.border}
                  >
                    <Box fontSize="15px" lineHeight={1.4} color={t.fg} minW={0}>{tr(c.title)}</Box>
                    <StatusChip status={c.status} />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Footnote mt="8px" maxW="70ch">{tr("features.all.note")} {tr("common.media.illustrative")}</Footnote>
      </Container>
    </Section>
  );
}

/** Closing band — the kit's CTABand points its secondary button at /features,
 *  which would be a self-link here, so this one points at /security. */
function ClosingCTA() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { open } = useWaitlist();
  return (
    <Section rule>
      <Container>
        <Box position="relative" display="flex" flexDirection="column" alignItems="center" textAlign="center">
          <Box aria-hidden position="absolute" inset="-30% 0" bg={t.glow} pointerEvents="none" />
          <Headline position="relative" text={tr("common.cta.title")} maxW="16ch" textAlign="center" />
          <Lead position="relative" align="center" mt="18px" maxW="40ch">{tr("common.cta.lead")}</Lead>
          <Box position="relative" mt="30px" display="flex" gap="12px" flexWrap="wrap" justifyContent="center">
            <SiteButton size="lg" onClick={open} arrow>{tr("common.cta.primary")}</SiteButton>
            <SiteButton size="lg" variant="secondary" href="/security">{tr("features.cta.secondary")}</SiteButton>
          </Box>
          <Footnote position="relative" align="center" mt="18px" maxW="56ch">{tr("common.cta.note")}</Footnote>
        </Box>
      </Container>
    </Section>
  );
}

function Content() {
  const { t } = useTranslate();
  const index = useMemo(
    () => [...AREAS.map((a) => ({ id: a.id, label: t(a.nav) })), { id: "all", label: t("features.index.all") }],
    [t],
  );
  return (
    <>
      <Hero />
      <Box position="relative">
        <SectionIndex items={index} />
        {AREAS.map((area, i) => (
          <AreaSection key={area.id} area={area} phoneSide={i % 2 === 0 ? "end" : "start"} />
        ))}
        <CapabilityIndex />
      </Box>
      <ClosingCTA />
    </>
  );
}

export default function FeaturesPage() {
  return (
    <SiteShell>
      <Content />
    </SiteShell>
  );
}
