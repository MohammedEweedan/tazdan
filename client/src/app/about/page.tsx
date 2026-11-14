"use client";

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAlertOctagon, FiAtSign, FiBookOpen, FiBriefcase, FiGlobe, FiLayers, FiMessageCircle,
  FiShield, FiTrendingUp, FiUsers, FiZap,
} from "react-icons/fi";
import {
  Body, BentoCard, BentoGrid, BrandMoment, Container, CTABand, Footnote, MediaHero, PainList, PhoneStage,
  Row, RowList, Section, SectionHeader, SiteButton, SiteShell, Steps, useSiteTheme, useWaitlist,
} from "@/components/site";

/** Small illustrative diagram for the "Honest rates" tile: market rate →
 *  our margin → your rate. No figures — it explains the order, not a price. */
function RateLadder() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const steps = [
    { label: t("company.about.values.rates.mid"), w: "100%", tone: theme.bgRaised },
    { label: t("company.about.values.rates.margin"), w: "88%", tone: theme.accentSoft },
    { label: t("company.about.values.rates.yours"), w: "76%", tone: theme.bgRaised },
  ];
  return (
    <Box display="grid" gap="8px" aria-hidden>
      {steps.map((s, i) => (
        <Box key={i} w={s.w} bg={s.tone} border="1px solid" borderColor={theme.border} borderRadius="12px" px="14px" py="10px"
          fontSize="14px" color={i === 2 ? theme.fg : theme.fgMuted} fontWeight={i === 2 ? 600 : 500}>
          {s.label}
        </Box>
      ))}
    </Box>
  );
}

function AboutContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { open } = useWaitlist();

  // Literal keys so the i18n checker can find them.
  const pains = [
    { pain: t("company.about.pain.cash.before"), fix: t("company.about.pain.cash.after") },
    { pain: t("company.about.pain.rate.before"), fix: t("company.about.pain.rate.after") },
    { pain: t("company.about.pain.family.before"), fix: t("company.about.pain.family.after") },
    { pain: t("company.about.pain.details.before"), fix: t("company.about.pain.details.after") },
    { pain: t("company.about.pain.save.before"), fix: t("company.about.pain.save.after") },
  ];
  const build = [
    { icon: FiBookOpen, title: t("company.about.build.ledger.title"), body: t("company.about.build.ledger.body") },
    { icon: FiLayers, title: t("company.about.build.funds.title"), body: t("company.about.build.funds.body") },
    { icon: FiAlertOctagon, title: t("company.about.build.halt.title"), body: t("company.about.build.halt.body") },
    { icon: FiUsers, title: t("company.about.build.dual.title"), body: t("company.about.build.dual.body") },
    { icon: FiZap, title: t("company.about.build.stepup.title"), body: t("company.about.build.stepup.body") },
  ];
  const stages = [
    { title: t("company.about.status.built.title"), body: t("company.about.status.built.body") },
    { title: t("company.about.status.now.title"), body: t("company.about.status.now.body") },
    { title: t("company.about.status.next.title"), body: t("company.about.status.next.body") },
    { title: t("company.about.status.later.title"), body: t("company.about.status.later.body") },
  ];

  return <>
    <MediaHero
      compact
      eyebrow={t("company.about.hero.eyebrow")}
      title={t("company.about.hero.title")}
      lead={t("company.about.hero.lead")}
      actions={<>
        <SiteButton size="lg" onClick={open} arrow>{t("company.common.join")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="/partners">{t("company.about.hero.secondary")}</SiteButton>
      </>}
      note={t("company.about.hero.note")}
    >
      <Box display="flex" flexDirection="column" alignItems="center" gap="18px">
        <Box position="relative">
          <Box aria-hidden position="absolute" inset="-18%" bg={theme.glow} pointerEvents="none" />
          <PhoneStage items={[{ screen: "home", alt: t("company.about.hero.alt") }]} index={0} priority w="min(300px, 74vw)" />
        </Box>
        <Footnote align="center">{t("common.media.illustrative")}</Footnote>
      </Box>
    </MediaHero>

    {/* The story: the gap tazdan exists to close. */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.about.story.eyebrow")} title={t("company.about.story.title")} lead={t("company.about.story.lead")} />
        <Box mt="clamp(28px, 4vw, 48px)" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }} gap="clamp(18px, 4vw, 72px)">
          <Box display={{ base: "none", lg: "block" }} />
          <Box>
            <Body>{t("company.about.story.p1")}</Body>
            <Body mt="16px" color={theme.fg}>{t("company.about.story.p2")}</Body>
          </Box>
        </Box>
        <Box mt="clamp(40px, 6vw, 80px)"><PainList items={pains} /></Box>
      </Container>
    </Section>

    <BrandMoment line={t("company.about.brand")} />

    {/* What we believe — the landing's bento language. */}
    <Section>
      <Container>
        <SectionHeader eyebrow={t("company.about.values.eyebrow")} title={t("company.about.values.title")} lead={t("company.about.values.lead")} />
        <BentoGrid mt="clamp(40px, 6vw, 80px)">
          <BentoCard span={4} size="sub" icon={FiTrendingUp} title={t("company.about.values.rates.title")} body={t("company.about.values.rates.body")}
            visual={<RateLadder />} />
          <BentoCard span={2} icon={FiGlobe} title={t("company.about.values.arabic.title")} body={t("company.about.values.arabic.body")}
            visual={<Box aria-hidden fontSize="clamp(48px, 6vw, 72px)" fontWeight={700} lineHeight={1} color={theme.fg} opacity={0.9} fontFamily="var(--font-cairo), sans-serif">تزدان</Box>} />
          <BentoCard span={3} icon={FiAtSign} title={t("company.about.values.privacy.title")} body={t("company.about.values.privacy.body")} />
          <BentoCard span={3} icon={FiShield} title={t("company.about.values.licensed.title")} body={t("company.about.values.licensed.body")}
            link={{ href: "/partners", label: t("company.about.values.licensed.link") }} />
        </BentoGrid>
      </Container>
    </Section>

    {/* How we build — ledger-first, with the app's own Activity screen. */}
    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.1fr) minmax(0,0.9fr)" }} gap="clamp(48px, 8vw, 120px)" alignItems="center">
          <Box>
            <SectionHeader layout="stack" eyebrow={t("company.about.build.eyebrow")} title={t("company.about.build.title")} lead={t("company.about.build.lead")} />
            <RowList mt="32px">
              {build.map((b) => <Row key={b.title} icon={b.icon} title={b.title} body={b.body} />)}
            </RowList>
            <Box mt="24px"><SiteButton variant="link" href="/security" arrow>{t("company.about.build.link")}</SiteButton></Box>
          </Box>
          <Box display="flex" flexDirection="column" alignItems="center" gap="16px">
            <Box position="relative">
              <Box aria-hidden position="absolute" inset="-20%" bg={theme.glow} pointerEvents="none" />
              <PhoneStage items={[{ screen: "history", alt: t("company.about.build.alt") }]} index={0} w="min(290px, 72vw)" />
            </Box>
          </Box>
        </Box>
      </Container>
    </Section>

    {/* Where we are — honest status, no dates promised. */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.about.status.eyebrow")} title={t("company.about.status.title")} lead={t("company.about.status.lead")}
          actions={<SiteButton variant="link" href="/partners" arrow>{t("company.about.status.link")}</SiteButton>} />
        <Box mt="clamp(40px, 6vw, 72px)"><Steps items={stages} /></Box>
        <Footnote mt="28px">{t("company.about.status.note")}</Footnote>
      </Container>
    </Section>

    {/* Work with us. */}
    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("company.about.join.eyebrow")} title={t("company.about.join.title")} />
        <BentoGrid mt="clamp(40px, 6vw, 72px)">
          <BentoCard span={2} icon={FiUsers} title={t("company.about.join.careers.title")} body={t("company.about.join.careers.body")}
            link={{ href: "/careers", label: t("company.about.join.careers.link") }} />
          <BentoCard span={2} icon={FiBriefcase} title={t("company.about.join.business.title")} body={t("company.about.join.business.body")}
            link={{ href: "/business", label: t("company.about.join.business.link") }} />
          <BentoCard span={2} icon={FiMessageCircle} title={t("company.about.join.contact.title")} body={t("company.about.join.contact.body")}
            link={{ href: "/contact", label: t("company.about.join.contact.link") }} />
        </BentoGrid>
      </Container>
    </Section>

    <CTABand />
  </>;
}

export default function AboutPage() {
  return <SiteShell><AboutContent /></SiteShell>;
}
