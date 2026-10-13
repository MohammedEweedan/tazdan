"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   /compliance — how tazdan keeps financial crime out, and what that means
   for an honest customer. Sources: docs/COMPLIANCE.md, regulatory/
   AML_ARCHITECTURE.md, KYC_ARCHITECTURE.md, SANCTIONS_CONTROLS.md,
   TRANSACTION_MONITORING.md, AUDITABILITY.md, DATA_RETENTION.md,
   REMITTANCE.md; KYC levels from mobile/app/kyc.tsx + server utils/kycLimits.
   Rule thresholds are deliberately NOT published. No licence claims; the
   "still to come" list states what the docs say is not built.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAlertCircle, FiArchive, FiBriefcase, FiCheck, FiClock, FiFileText, FiGlobe, FiHelpCircle, FiLock, FiSearch, FiShield,
  FiSlash, FiUserCheck, FiUsers,
} from "react-icons/fi";
import {
  BentoCard, BentoGrid, Container, CTABand, FAQList, Footnote, MediaHero, PainList, PhoneStage, Row, RowList, Section,
  SectionHeader, SiteButton, StatusChip, useSiteTheme, useWaitlist,
} from "@/components/site";
import { DefList, MediaNote, NoteStrip } from "./shared";

/** Verification levels, as the app's Verification screen shows them. */
function Levels() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const levels = [
    { n: "0", title: tr("safety.compliance.kyc.l0.title"), body: tr("safety.compliance.kyc.l0.body") },
    { n: "1", title: tr("safety.compliance.kyc.l1.title"), body: tr("safety.compliance.kyc.l1.body") },
    { n: "2", title: tr("safety.compliance.kyc.l2.title"), body: tr("safety.compliance.kyc.l2.body") },
    { n: "3", title: tr("safety.compliance.kyc.l3.title"), body: tr("safety.compliance.kyc.l3.body") },
  ];
  return (
    <Box as="ol" listStyleType="none" position="relative">
      {levels.map((l, i) => (
        <Box as="li" key={l.n} display="flex" gap="18px" pb={i < levels.length - 1 ? "26px" : 0} position="relative">
          {i < levels.length - 1 && (
            <Box aria-hidden position="absolute" top="40px" bottom="0" w="1px" bg={t.divider} style={{ insetInlineStart: "19px" }} />
          )}
          <Box w="40px" h="40px" minW="40px" borderRadius="999px" display="flex" alignItems="center" justifyContent="center"
            fontWeight={700} fontSize="15px" bg={i === 0 ? t.bgRaised : t.fg} color={i === 0 ? t.fgMuted : t.bg} dir="ltr">
            {l.n}
          </Box>
          <Box pt="8px">
            <Box fontSize={{ base: "16.5px", md: "18px" }} fontWeight={600} color={t.fg}>{l.title}</Box>
            <Box as="p" mt="4px" fontSize="15px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>{l.body}</Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** The 17 rules grouped by what they look for — no thresholds. */
function RuleGroups() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const groups = [
    { n: 1, title: tr("safety.compliance.rules.geo.title"), body: tr("safety.compliance.rules.geo.body"), tone: t.fgFaint },
    { n: 2, title: tr("safety.compliance.rules.sanctions.title"), body: tr("safety.compliance.rules.sanctions.body"), tone: t.amber },
    { n: 7, title: tr("safety.compliance.rules.aml.title"), body: tr("safety.compliance.rules.aml.body"), tone: t.accentText },
    { n: 7, title: tr("safety.compliance.rules.fraud.title"), body: tr("safety.compliance.rules.fraud.body"), tone: t.green },
  ];
  return (
    <Box>
      <Box display="flex" gap="3px" aria-hidden mb="24px">
        {groups.flatMap((g, gi) => Array.from({ length: g.n }, (_, i) => (
          <Box key={`${gi}-${i}`} flex="1" h="40px" borderRadius="6px" bg={g.tone} opacity={0.85} />
        )))}
      </Box>
      <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }} gap="20px 32px">
        {groups.map((g) => (
          <Box key={g.title} borderTop="1px solid" borderColor={t.divider} pt="14px">
            <Box display="flex" alignItems="center" gap="10px" fontSize="16.5px" fontWeight={600} color={t.fg}>
              <Box as="span" w="10px" h="10px" borderRadius="3px" bg={g.tone} aria-hidden />
              <span>{g.title}</span>
              <Box as="span" color={t.fgFaint} fontWeight={500} dir="ltr">· {g.n}</Box>
            </Box>
            <Box as="p" mt="6px" fontSize="15px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>{g.body}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ComplianceContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { open } = useWaitlist();

  const honest = [
    { pain: t("safety.compliance.honest.1.before"), fix: t("safety.compliance.honest.1.after") },
    { pain: t("safety.compliance.honest.2.before"), fix: t("safety.compliance.honest.2.after") },
    { pain: t("safety.compliance.honest.3.before"), fix: t("safety.compliance.honest.3.after") },
    { pain: t("safety.compliance.honest.4.before"), fix: t("safety.compliance.honest.4.after") },
  ];

  const outcomes = [
    { icon: FiCheck, title: t("safety.compliance.outcome.approve.title"), body: t("safety.compliance.outcome.approve.body") },
    { icon: FiShield, title: t("safety.compliance.outcome.challenge.title"), body: t("safety.compliance.outcome.challenge.body") },
    { icon: FiClock, title: t("safety.compliance.outcome.review.title"), body: t("safety.compliance.outcome.review.body") },
    { icon: FiSlash, title: t("safety.compliance.outcome.refuse.title"), body: t("safety.compliance.outcome.refuse.body") },
  ];

  const later = [
    { term: t("safety.compliance.later.reporting.title"), desc: t("safety.compliance.later.reporting.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.compliance.later.travel.title"), desc: t("safety.compliance.later.travel.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.compliance.later.reverify.title"), desc: t("safety.compliance.later.reverify.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.compliance.later.programme.title"), desc: t("safety.compliance.later.programme.body"), trailing: <StatusChip status="inProgress" /> },
    { term: t("safety.compliance.later.licence.title"), desc: t("safety.compliance.later.licence.body"), trailing: <StatusChip status="inProgress" /> },
  ];

  const faqs = [
    { q: t("safety.compliance.faq.1.q"), a: t("safety.compliance.faq.1.a") },
    { q: t("safety.compliance.faq.2.q"), a: t("safety.compliance.faq.2.a") },
    { q: t("safety.compliance.faq.3.q"), a: t("safety.compliance.faq.3.a") },
    { q: t("safety.compliance.faq.4.q"), a: t("safety.compliance.faq.4.a") },
  ];

  return <>
    <MediaHero
      compact
      eyebrow={t("safety.compliance.hero.eyebrow")}
      title={t("safety.compliance.hero.title")}
      lead={t("safety.compliance.hero.lead")}
      actions={<>
        <SiteButton size="lg" onClick={open} arrow>{t("common.cta.primary")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="#levels">{t("safety.compliance.hero.secondary")}</SiteButton>
      </>}
      note={t("safety.compliance.hero.note")}
    />

    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.honest.eyebrow")} title={t("safety.compliance.honest.title")} lead={t("safety.compliance.honest.lead")} />
        <Box mt="clamp(36px, 5vw, 72px)"><PainList items={honest} /></Box>
      </Container>
    </Section>

    {/* KYC levels */}
    <Section id="levels" rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.15fr) minmax(0,0.85fr)" }} gap="clamp(48px, 7vw, 112px)" alignItems="center">
          <Box minW={0}>
            <SectionHeader layout="stack" eyebrow={t("safety.compliance.kyc.eyebrow")} title={t("safety.compliance.kyc.title")} lead={t("safety.compliance.kyc.lead")} />
            <Box mt="36px"><Levels /></Box>
            <RowList mt="36px">
              <Row icon={FiClock} title={t("safety.compliance.kyc.limits.title")} body={t("safety.compliance.kyc.limits.body")} />
              <Row icon={FiUserCheck} title={t("safety.compliance.kyc.review.title")} body={t("safety.compliance.kyc.review.body")} />
              <Row icon={FiBriefcase} title={t("safety.compliance.kyc.kyb.title")} body={t("safety.compliance.kyc.kyb.body")} />
            </RowList>
          </Box>
          <Box position="relative" display="flex" flexDirection="column" alignItems="center">
            <Box aria-hidden position="absolute" inset="-14%" bg={theme.glow} pointerEvents="none" />
            <PhoneStage items={[{ screen: "kyc", alt: t("safety.compliance.kyc.alt") }]} index={0} w="min(300px, 74vw)" position="relative" />
            <MediaNote text={t("common.media.illustrative")} />
          </Box>
        </Box>
      </Container>
    </Section>

    {/* Screening + monitoring */}
    <Section id="screening" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.screen.eyebrow")} title={t("safety.compliance.screen.title")} lead={t("safety.compliance.screen.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 72px)">
          <BentoCard span={3} icon={FiUsers} title={t("safety.compliance.screen.who.title")} body={t("safety.compliance.screen.who.body")} />
          <BentoCard span={3} icon={FiSearch} title={t("safety.compliance.screen.how.title")} body={t("safety.compliance.screen.how.body")} />
          <BentoCard span={2} icon={FiHelpCircle} title={t("safety.compliance.screen.person.title")} body={t("safety.compliance.screen.person.body")} />
          <BentoCard span={2} icon={FiGlobe} title={t("safety.compliance.screen.geo.title")} body={t("safety.compliance.screen.geo.body")} />
          <BentoCard span={2} icon={FiFileText} title={t("safety.compliance.screen.lists.title")} body={t("safety.compliance.screen.lists.body")} />
        </BentoGrid>
      </Container>
    </Section>

    <Section id="monitoring" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.monitor.eyebrow")} title={t("safety.compliance.monitor.title")} lead={t("safety.compliance.monitor.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 72px)">
          <BentoCard span={6} icon={FiShield} title={t("safety.compliance.monitor.rules.title")} body={t("safety.compliance.monitor.rules.body")} size="sub">
            <Box mt="28px"><RuleGroups /></Box>
          </BentoCard>
        </BentoGrid>
        <Box mt="clamp(40px, 5vw, 64px)" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.75fr) minmax(0,1.25fr)" }} gap="clamp(20px, 5vw, 80px)">
          <SectionHeader layout="stack" title={t("safety.compliance.outcome.title")} lead={t("safety.compliance.outcome.lead")} />
          <RowList>{outcomes.map((o) => <Row key={o.title} icon={o.icon} title={o.title} body={o.body} />)}</RowList>
        </Box>
      </Container>
    </Section>

    {/* Cases */}
    <Section id="cases" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.cases.eyebrow")} title={t("safety.compliance.cases.title")} lead={t("safety.compliance.cases.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 72px)">
          <BentoCard span={2} icon={FiClock} title={t("safety.compliance.cases.sla.title")} body={t("safety.compliance.cases.sla.body")} />
          <BentoCard span={2} icon={FiArchive} title={t("safety.compliance.cases.file.title")} body={t("safety.compliance.cases.file.body")} />
          <BentoCard span={2} icon={FiLock} title={t("safety.compliance.cases.roles.title")} body={t("safety.compliance.cases.roles.body")} />
        </BentoGrid>
      </Container>
    </Section>

    {/* Records */}
    <Section id="records" rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.85fr) minmax(0,1.15fr)" }} gap="clamp(48px, 7vw, 112px)" alignItems="center">
          <Box position="relative" display="flex" flexDirection="column" alignItems="center" order={{ base: 2, lg: 1 }}>
            <Box aria-hidden position="absolute" inset="-14%" bg={theme.glow} pointerEvents="none" />
            <PhoneStage items={[{ screen: "statements", alt: t("safety.compliance.records.alt") }]} index={0} w="min(300px, 74vw)" position="relative" />
            <MediaNote text={t("common.media.illustrative")} />
          </Box>
          <Box minW={0} order={{ base: 1, lg: 2 }}>
            <SectionHeader layout="stack" eyebrow={t("safety.compliance.records.eyebrow")} title={t("safety.compliance.records.title")} lead={t("safety.compliance.records.lead")} />
            <RowList mt="32px">
              <Row icon={FiArchive} title={t("safety.compliance.records.kept.title")} body={t("safety.compliance.records.kept.body")} />
              <Row icon={FiFileText} title={t("safety.compliance.records.quotes.title")} body={t("safety.compliance.records.quotes.body")} />
              <Row icon={FiClock} title={t("safety.compliance.records.retention.title")} body={t("safety.compliance.records.retention.body")} />
            </RowList>
            <Box mt="22px" display="flex" gap="22px" flexWrap="wrap">
              <SiteButton variant="link" href="/privacy" arrow>{t("safety.compliance.records.privacyLink")}</SiteButton>
              <SiteButton variant="link" href="/delete-account" arrow>{t("safety.compliance.records.deleteLink")}</SiteButton>
            </Box>
          </Box>
        </Box>
      </Container>
    </Section>

    {/* Transfers abroad */}
    <Section id="abroad" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.abroad.eyebrow")} title={t("safety.compliance.abroad.title")} lead={t("safety.compliance.abroad.lead")}
          actions={<StatusChip status="pilot" />} />
        <Box mt="clamp(32px, 4vw, 56px)">
          <DefList items={[
            { term: t("safety.compliance.abroad.sender.title"), desc: t("safety.compliance.abroad.sender.body") },
            { term: t("safety.compliance.abroad.beneficiary.title"), desc: t("safety.compliance.abroad.beneficiary.body") },
            { term: t("safety.compliance.abroad.purpose.title"), desc: t("safety.compliance.abroad.purpose.body") },
            { term: t("safety.compliance.abroad.quote.title"), desc: t("safety.compliance.abroad.quote.body") },
          ]} />
        </Box>
        <Footnote mt="18px" maxW="80ch">{t("safety.compliance.abroad.note")}</Footnote>
      </Container>
    </Section>

    {/* Still to come */}
    <Section id="still-to-come" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.compliance.later.eyebrow")} title={t("safety.compliance.later.title")} lead={t("safety.compliance.later.lead")} />
        <Box mt="clamp(32px, 4vw, 56px)"><DefList items={later} /></Box>
        <NoteStrip icon={FiAlertCircle} mt="clamp(36px, 4vw, 56px)" maxW="80ch" title={t("safety.compliance.concern.title")}>
          <p style={{ textAlign: "start" }}>{t("safety.compliance.concern.body")}</p>
          <Box mt="10px"><SiteButton variant="link" href="/contact" arrow>{t("safety.compliance.concern.link")}</SiteButton></Box>
        </NoteStrip>
      </Container>
    </Section>

    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.8fr) minmax(0,1.2fr)" }} gap="clamp(28px, 5vw, 80px)">
          <SectionHeader layout="stack" eyebrow={t("safety.compliance.faq.eyebrow")} title={t("safety.compliance.faq.title")} />
          <FAQList items={faqs} />
        </Box>
        <Footnote mt="48px" maxW="80ch">{t("safety.compliance.disclaimer")}</Footnote>
      </Container>
    </Section>

    <CTABand title={t("safety.compliance.cta.title")} secondary={{ label: t("safety.compliance.cta.secondary"), href: "/security" }} />
  </>;
}

export default function CompliancePage() {
  return <ComplianceContent />;
}
