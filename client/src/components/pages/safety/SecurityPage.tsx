"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   /security — "Your money, your details, protected."

   Three chapters (safety of funds → security of transactions → private by
   design), each pain → protection. Every claim is sourced:
     funds        docs/LEDGER.md, regulatory/CUSTOMER_FUNDS.md, FUNDS_FLOW.md,
                  RECONCILIATION_CONTROLS.md, AUDITABILITY.md, TRANSACTIONS.md
     transactions docs/SECURITY.md, FRAUD.md, COMPLIANCE.md (17 rules),
                  regulatory/SANCTIONS_CONTROLS.md
     privacy      P2P near-me rules (server utils/geo.ts, p2p.controller),
                  claimLink.controller, contacts.controller (never email or
                  phone), SECURITY.md (staff masking, AI masking, hashes only)
   Deliberately NOT claimed: chat encryption, "we don't sell data",
   certifications, licences, deposit protection, safeguarding in place.
   ═══════════════════════════════════════════════════════════════════════════ */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiActivity, FiAlertOctagon, FiAtSign, FiCheck, FiCode, FiCopy, FiEdit3, FiEye, FiEyeOff, FiFileText, FiKey, FiLink,
  FiLock, FiMapPin, FiPauseCircle, FiSearch, FiShield, FiSmartphone, FiUser, FiUsers, FiX,
} from "react-icons/fi";
import {
  BentoCard, BentoGrid, BrandMoment, Container, CTABand, FAQList, Footnote, MediaHero, PainList, PhoneJourney, PhoneStage,
  Row, RowList, Section, SectionHeader, SiteButton, Stat, StatusChip, useSiteTheme, useWaitlist, type Chapter,
} from "@/components/site";
import LedgerDiagram from "./LedgerDiagram";
import NearMeDiagram from "./NearMeDiagram";
import { AnchorIndex, DefList, MediaNote, NoteStrip } from "./shared";

const SECURITY_EMAIL = "security@tazdan.com";

/** The 17 risk rules by category (docs/COMPLIANCE.md): 1 geography,
 *  2 sanctions, 7 money-laundering patterns, 7 fraud patterns. */
function RuleBar() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const groups = [
    { n: 1, label: tr("safety.security.rules.geo"), tone: t.fgFaint },
    { n: 2, label: tr("safety.security.rules.sanctions"), tone: t.amber },
    { n: 7, label: tr("safety.security.rules.aml"), tone: t.accentText },
    { n: 7, label: tr("safety.security.rules.fraud"), tone: t.green },
  ];
  return (
    <Box>
      <Box display="flex" gap="3px" aria-hidden>
        {groups.flatMap((g, gi) => Array.from({ length: g.n }, (_, i) => (
          <Box key={`${gi}-${i}`} flex="1" h="34px" borderRadius="6px" bg={g.tone} opacity={0.85} />
        )))}
      </Box>
      <Box as="ul" listStyleType="none" mt="14px" display="flex" flexWrap="wrap" gap="8px 18px" fontSize="13.5px" color={t.fgMuted}>
        {groups.map((g) => (
          <Box as="li" key={g.label} display="inline-flex" alignItems="center" gap="7px">
            <Box as="span" w="8px" h="8px" borderRadius="3px" bg={g.tone} aria-hidden />
            <span dir="ltr">{g.n}</span> {g.label}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Step-up methods, drawn as the app's pill choices. */
function MethodPills() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const items = [tr("safety.security.stepup.email"), tr("safety.security.stepup.totp"), tr("safety.security.stepup.bio")];
  return (
    <Box as="ul" listStyleType="none" display="flex" flexWrap="wrap" gap="8px">
      {items.map((s) => (
        <Box as="li" key={s} display="inline-flex" alignItems="center" gap="8px" h="36px" px="14px" borderRadius="999px"
          border="1px solid" borderColor={t.borderStrong} fontSize="14px" color={t.fg}>
          <FiCheck aria-hidden color={t.green} /> {s}
        </Box>
      ))}
    </Box>
  );
}

/** "They see" / "They never see" list inside a bento tile. */
function SeenList({ items, seen }: { items: string[]; seen: boolean }) {
  const t = useSiteTheme();
  return (
    <Box as="ul" listStyleType="none" mt="18px" display="grid" gap="12px">
      {items.map((s) => (
        <Box as="li" key={s} display="flex" gap="12px" alignItems="flex-start" fontSize="15.5px" lineHeight={1.5} color={t.fg}>
          <Box as="span" mt="2px" w="22px" h="22px" minW="22px" borderRadius="999px" display="flex" alignItems="center" justifyContent="center"
            bg={seen ? t.greenSoft : t.bgRaised} color={seen ? t.green : t.fgMuted} aria-hidden>
            {seen ? <FiEye size={12} /> : <FiX size={12} />}
          </Box>
          {s}
        </Box>
      ))}
    </Box>
  );
}

function SecurityContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { open } = useWaitlist();

  const journey: Chapter[] = [
    { id: "j-funds", eyebrow: t("safety.security.journey.funds.eyebrow"), title: t("safety.security.journey.funds.title"),
      body: t("safety.security.journey.funds.body"), status: "inApp", media: { screen: "statements", alt: t("safety.security.journey.funds.alt") } },
    { id: "j-twofa", eyebrow: t("safety.security.journey.twofa.eyebrow"), title: t("safety.security.journey.twofa.title"),
      body: t("safety.security.journey.twofa.body"), status: "inApp", media: { screen: "twofa", alt: t("safety.security.journey.twofa.alt") } },
    { id: "j-devices", eyebrow: t("safety.security.journey.devices.eyebrow"), title: t("safety.security.journey.devices.title"),
      body: t("safety.security.journey.devices.body"), status: "inApp", media: { screen: "devices", alt: t("safety.security.journey.devices.alt") } },
    { id: "j-escrow", eyebrow: t("safety.security.journey.escrow.eyebrow"), title: t("safety.security.journey.escrow.title"),
      body: t("safety.security.journey.escrow.body"), status: "inApp", media: { screen: "p2p", alt: t("safety.security.journey.escrow.alt") } },
    { id: "j-hidden", eyebrow: t("safety.security.journey.hidden.eyebrow"), title: t("safety.security.journey.hidden.title"),
      body: t("safety.security.journey.hidden.body"), status: "inApp", media: { screen: "privacy-hidden", alt: t("safety.security.journey.hidden.alt") } },
    { id: "j-handle", eyebrow: t("safety.security.journey.handle.eyebrow"), title: t("safety.security.journey.handle.title"),
      body: t("safety.security.journey.handle.body"), status: "inApp", media: { screen: "receive", alt: t("safety.security.journey.handle.alt") } },
    { id: "j-kyc", eyebrow: t("safety.security.journey.kyc.eyebrow"), title: t("safety.security.journey.kyc.title"),
      body: t("safety.security.journey.kyc.body"), status: "inApp", media: { screen: "kyc", alt: t("safety.security.journey.kyc.alt") } },
  ];

  const pains = [
    { pain: t("safety.security.pain.1.before"), fix: t("safety.security.pain.1.after") },
    { pain: t("safety.security.pain.2.before"), fix: t("safety.security.pain.2.after") },
    { pain: t("safety.security.pain.3.before"), fix: t("safety.security.pain.3.after") },
    { pain: t("safety.security.pain.4.before"), fix: t("safety.security.pain.4.after") },
  ];

  const privacyRows = [
    { icon: FiAtSign, title: t("safety.security.privacy.handle.title"), body: t("safety.security.privacy.handle.body") },
    { icon: FiLink, title: t("safety.security.privacy.claim.title"), body: t("safety.security.privacy.claim.body") },
    { icon: FiUser, title: t("safety.security.privacy.p2p.title"), body: t("safety.security.privacy.p2p.body") },
    { icon: FiEyeOff, title: t("safety.security.privacy.mode.title"), body: t("safety.security.privacy.mode.body") },
    { icon: FiShield, title: t("safety.security.privacy.staff.title"), body: t("safety.security.privacy.staff.body") },
    { icon: FiKey, title: t("safety.security.privacy.less.title"), body: t("safety.security.privacy.less.body") },
  ];

  const notYet = [
    { term: t("safety.security.notyet.pentest.title"), desc: t("safety.security.notyet.pentest.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.security.notyet.audits.title"), desc: t("safety.security.notyet.audits.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.security.notyet.safeguarding.title"), desc: t("safety.security.notyet.safeguarding.body"), trailing: <StatusChip status="planned" /> },
    { term: t("safety.security.notyet.kms.title"), desc: t("safety.security.notyet.kms.body"), trailing: <StatusChip status="inProgress" /> },
    { term: t("safety.security.notyet.licence.title"), desc: t("safety.security.notyet.licence.body"), trailing: <StatusChip status="inProgress" /> },
  ];

  const faqs = [
    { q: t("safety.security.faq.1.q"), a: t("safety.security.faq.1.a") },
    { q: t("safety.security.faq.2.q"), a: t("safety.security.faq.2.a") },
    { q: t("safety.security.faq.3.q"), a: t("safety.security.faq.3.a") },
    { q: t("safety.security.faq.4.q"), a: t("safety.security.faq.4.a") },
    { q: t("safety.security.faq.5.q"), a: t("safety.security.faq.5.a") },
    { q: t("safety.security.faq.6.q"), a: t("safety.security.faq.6.a") },
  ];

  return <>
    <MediaHero
      compact
      video="/videos/hero-background.mp4"
      eyebrow={t("safety.security.hero.eyebrow")}
      title={t("safety.security.hero.title")}
      lead={t("safety.security.hero.lead")}
      actions={<>
        <SiteButton size="lg" onClick={open} arrow>{t("common.cta.primary")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="#funds">{t("safety.security.hero.secondary")}</SiteButton>
      </>}
      note={t("safety.security.hero.note")}
    >
      <Box pb="clamp(40px, 6vw, 72px)">
        <AnchorIndex label={t("safety.security.index.label")} items={[
          { href: "#funds", title: t("safety.security.index.funds.title"), body: t("safety.security.index.funds.body") },
          { href: "#transactions", title: t("safety.security.index.tx.title"), body: t("safety.security.index.tx.body") },
          { href: "#privacy", title: t("safety.security.index.privacy.title"), body: t("safety.security.index.privacy.body") },
        ]} />
      </Box>
    </MediaHero>

    <Section id="journey" py={0}>
      <PhoneJourney chapters={journey} />
      <Container><Footnote align="center" pb="40px">{t("common.media.illustrative")}</Footnote></Container>
    </Section>

    <Section rule>
      <Container>
        <SectionHeader eyebrow={t("safety.security.pain.eyebrow")} title={t("safety.security.pain.title")} lead={t("safety.security.pain.lead")} />
        <Box mt="clamp(36px, 5vw, 72px)"><PainList items={pains} /></Box>
        <Box mt="clamp(48px, 6vw, 88px)" display="grid" gridTemplateColumns={{ base: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" }}
          gap={{ base: "28px 20px", md: "32px" }}>
          <Stat value={t("safety.security.stats.1.value")} label={t("safety.security.stats.1.label")} />
          <Stat value={t("safety.security.stats.2.value")} label={t("safety.security.stats.2.label")} />
          <Stat value={t("safety.security.stats.3.value")} label={t("safety.security.stats.3.label")} />
          <Stat value={t("safety.security.stats.4.value")} label={t("safety.security.stats.4.label")} />
        </Box>
      </Container>
    </Section>

    {/* ── 01 Safety of funds ─────────────────────────────────────────── */}
    <Section id="funds" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.security.funds.eyebrow")} title={t("safety.security.funds.title")} lead={t("safety.security.funds.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 72px)">
          <BentoCard span={6} icon={FiFileText} status="inApp" title={t("safety.security.funds.diagram.title")}
            body={t("safety.security.funds.diagram.body")} size="sub">
            <Box mt="28px"><LedgerDiagram /></Box>
          </BentoCard>
          <BentoCard span={3} icon={FiCheck} title={t("safety.security.funds.p1.title")} body={t("safety.security.funds.p1.body")} />
          <BentoCard span={3} icon={FiEdit3} title={t("safety.security.funds.p2.title")} body={t("safety.security.funds.p2.body")} />
          <BentoCard span={2} icon={FiUsers} title={t("safety.security.funds.p3.title")} body={t("safety.security.funds.p3.body")} />
          <BentoCard span={2} icon={FiLock} title={t("safety.security.funds.p4.title")} body={t("safety.security.funds.p4.body")} />
          <BentoCard span={2} icon={FiCopy} title={t("safety.security.funds.p5.title")} body={t("safety.security.funds.p5.body")} />
          <BentoCard span={3} icon={FiPauseCircle} title={t("safety.security.funds.p6.title")} body={t("safety.security.funds.p6.body")} />
          <BentoCard span={3} icon={FiActivity} title={t("safety.security.funds.p7.title")} body={t("safety.security.funds.p7.body")} />
        </BentoGrid>
        <NoteStrip id="partner" mt="clamp(40px, 5vw, 64px)" maxW="80ch" title={t("safety.security.partner.title")}>
          <p style={{ textAlign: "start" }}>{t("safety.security.partner.body")}</p>
          <p style={{ textAlign: "start" }}>{t("safety.security.partner.body2")}</p>
          <Box mt="10px"><SiteButton variant="link" href="/partners" arrow>{t("safety.security.partner.link")}</SiteButton></Box>
        </NoteStrip>
      </Container>
    </Section>

    {/* ── 02 Security of transactions ───────────────────────────────── */}
    <Section id="transactions" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.security.tx.eyebrow")} title={t("safety.security.tx.title")} lead={t("safety.security.tx.lead")} />
        <BentoGrid mt="clamp(36px, 5vw, 72px)">
          <BentoCard span={3} icon={FiSmartphone} status="inApp" title={t("safety.security.tx.sessions.title")} body={t("safety.security.tx.sessions.body")} />
          <BentoCard span={3} icon={FiShield} status="inApp" title={t("safety.security.tx.stepup.title")} body={t("safety.security.tx.stepup.body")}
            visual={<MethodPills />} />
          <BentoCard span={2} icon={FiKey} status="inApp" title={t("safety.security.tx.onchain.title")} body={t("safety.security.tx.onchain.body")} />
          <BentoCard span={2} icon={FiLock} status="inApp" title={t("safety.security.tx.escrow.title")} body={t("safety.security.tx.escrow.body")} />
          <BentoCard span={2} icon={FiSearch} title={t("safety.security.tx.screening.title")} body={t("safety.security.tx.screening.body")} />
          <BentoCard span={4} icon={FiActivity} title={t("safety.security.tx.risk.title")} body={t("safety.security.tx.risk.body")}
            visual={<RuleBar />} link={{ href: "/compliance", label: t("safety.security.tx.risk.link") }} />
          <BentoCard span={2} icon={FiAlertOctagon} title={t("safety.security.tx.limits.title")} body={t("safety.security.tx.limits.body")} />
          <BentoCard span={3} icon={FiLock} title={t("safety.security.tx.custody.title")} body={t("safety.security.tx.custody.body")} />
          <BentoCard span={3} icon={FiCode} status="inApp" title={t("safety.security.tx.webhooks.title")} body={t("safety.security.tx.webhooks.body")}
            link={{ href: "/business", label: t("safety.security.tx.webhooks.link") }} />
        </BentoGrid>
      </Container>
    </Section>

    {/* ── 03 Private by design ──────────────────────────────────────── */}
    <Section id="privacy" rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1.15fr) minmax(0,0.85fr)" }}
          gap="clamp(48px, 7vw, 112px)" alignItems="center">
          <Box minW={0}>
            <SectionHeader layout="stack" eyebrow={t("safety.security.privacy.eyebrow")} title={t("safety.security.privacy.title")}
              lead={t("safety.security.privacy.lead")} />
            <RowList mt="32px">
              {privacyRows.map((r) => <Row key={r.title} icon={r.icon} title={r.title} body={r.body} />)}
            </RowList>
          </Box>
          <Box position="relative" display="flex" flexDirection="column" alignItems="center">
            <Box aria-hidden position="absolute" inset="-14%" bg={theme.glow} pointerEvents="none" />
            <PhoneStage items={[{ video: "flow-privacy", screen: "privacy-hidden", alt: t("safety.security.privacy.alt") }]} index={0}
              w="min(300px, 74vw)" position="relative" />
            <MediaNote text={t("common.media.illustrative")} />
          </Box>
        </Box>

        <BentoGrid mt="clamp(56px, 7vw, 104px)">
          <BentoCard span={3} icon={FiEye} title={t("safety.security.seen.title")} body={t("safety.security.seen.body")}>
            <SeenList seen items={[t("safety.security.seen.1"), t("safety.security.seen.2"), t("safety.security.seen.3"), t("safety.security.seen.4")]} />
          </BentoCard>
          <BentoCard span={3} icon={FiEyeOff} title={t("safety.security.never.title")} body={t("safety.security.never.body")}>
            <SeenList seen={false} items={[t("safety.security.never.1"), t("safety.security.never.2"), t("safety.security.never.3"),
              t("safety.security.never.4"), t("safety.security.never.5")]} />
          </BentoCard>
          <BentoCard span={6} icon={FiMapPin} status="inApp" title={t("safety.near.title")} body={t("safety.near.body")} size="sub">
            <Box mt="28px"><NearMeDiagram /></Box>
          </BentoCard>
        </BentoGrid>
        <Footnote mt="22px" maxW="80ch">
          {t("safety.security.privacy.sharing")}{" "}
          <SiteButton variant="link" href="/privacy" fontSize="13px">{t("safety.security.privacy.policyLink")}</SiteButton>
        </Footnote>
      </Container>
    </Section>

    <BrandMoment line={t("safety.security.kyc.line")} />

    <Section tight>
      <Container narrow>
        <SectionHeader layout="stack" align="center" title={t("safety.security.kyc.title")} lead={t("safety.security.kyc.body")}
          actions={<SiteButton variant="link" href="/compliance" arrow>{t("safety.security.kyc.link")}</SiteButton>} />
      </Container>
    </Section>

    {/* ── honesty ───────────────────────────────────────────────────── */}
    <Section id="not-yet" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.security.notyet.eyebrow")} title={t("safety.security.notyet.title")} lead={t("safety.security.notyet.lead")} />
        <Box mt="clamp(32px, 4vw, 56px)"><DefList items={notYet} /></Box>
      </Container>
    </Section>

    <Section id="report" rule>
      <Container>
        <SectionHeader eyebrow={t("safety.security.report.eyebrow")} title={t("safety.security.report.title")} lead={t("safety.security.report.lead")}
          actions={<>
            <SiteButton href={`mailto:${SECURITY_EMAIL}`} external><span dir="ltr">{SECURITY_EMAIL}</span></SiteButton>
            <SiteButton variant="secondary" href="/contact">{t("safety.security.report.contact")}</SiteButton>
          </>} />
        <Box mt="clamp(32px, 4vw, 56px)" display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", md: "repeat(2, minmax(0,1fr))" }} gap="clamp(24px, 4vw, 56px)">
          <Box>
            <Box fontSize="17px" fontWeight={600} color={theme.fg} mb="6px">{t("safety.security.report.do.title")}</Box>
            <RowList>
              <Row icon={FiCheck} title={t("safety.security.report.do.1")} />
              <Row icon={FiCheck} title={t("safety.security.report.do.2")} />
              <Row icon={FiCheck} title={t("safety.security.report.do.3")} />
            </RowList>
          </Box>
          <Box>
            <Box fontSize="17px" fontWeight={600} color={theme.fg} mb="6px">{t("safety.security.report.dont.title")}</Box>
            <RowList>
              <Row icon={FiX} title={t("safety.security.report.dont.1")} />
              <Row icon={FiX} title={t("safety.security.report.dont.2")} />
              <Row icon={FiX} title={t("safety.security.report.dont.3")} />
            </RowList>
          </Box>
        </Box>
      </Container>
    </Section>

    <Section rule>
      <Container>
        <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.8fr) minmax(0,1.2fr)" }} gap="clamp(28px, 5vw, 80px)">
          <SectionHeader layout="stack" eyebrow={t("safety.security.faq.eyebrow")} title={t("safety.security.faq.title")} />
          <FAQList items={faqs} />
        </Box>
      </Container>
    </Section>

    <CTABand title={t("safety.security.cta.title")} secondary={{ label: t("safety.security.cta.secondary"), href: "/trust" }} />
  </>;
}

export default function SecurityPage() {
  return <SecurityContent />;
}
