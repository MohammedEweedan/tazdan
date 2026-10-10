"use client";

import {
  FiAward, FiCode, FiLayers, FiLock, FiMapPin, FiMessageCircle, FiRepeat, FiShield, FiSliders, FiSmartphone, FiUserCheck,
} from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import {
  CTABand, Container, FeatureGrid, Footnote, PageHero, PainList, Section, SectionHeader, SiteButton, SiteShell, StoryScroll,
  useWaitlist, type Chapter,
} from "@/components/site";
import { StageRail } from "@/components/pages/partners/StageRail";
import { PartnerTimeline } from "@/components/pages/partners/PartnerTimeline";
import { ForPartners } from "@/components/pages/partners/ForPartners";
import { Dateline, PainColumns } from "@/components/pages/partners/bits";
import type { PartnerEntry, StageDef } from "@/components/pages/partners/types";

/* ═══════════════════════════════════════════════════════════════════════════
   PARTNERS & LICENSING — the single source of truth for this page.

   To change a relationship, edit its `status` below:
     inProgress  work under way (e.g. a licence application)
     discussion  conversations open, nothing signed
     pipeline    a prospective partner we're evaluating, no agreement
     signed      an agreement is signed, not yet live for customers
     licensed    a licence has been granted
     live        the partner's service is live for customers
   When you flip a status, also update that entry's `next` line (and, if
   needed, `means`) in src/i18n/site/partners/*.json, and bump REVIEWED and
   `partners.status.date`.

   Truth rules (docs/legal/licensing-memo.md, TAZDAN_REMAINING_EXTERNAL_
   DEPENDENCIES.md): nothing here is a licence, contract or certification.
   Never write "licensed / approved / regulated by" the CBL until it is so.
   Do not name a specific Libyan bank until an agreement exists. Company
   names are plain-text wordmarks — never their logo files.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Machine-readable review date; the visible one is `partners.status.date`. */
const REVIEWED = "2026-10";

const STAGES: StageDef[] = [
  { id: "licensing", name: "partners.stage.licensing.name", desc: "partners.stage.licensing.desc" },
  { id: "banking", name: "partners.stage.banking.name", desc: "partners.stage.banking.desc" },
  { id: "pipeline", name: "partners.stage.pipeline.name", desc: "partners.stage.pipeline.desc" },
];

const PARTNERS: PartnerEntry[] = [
  {
    id: "cbl",
    stage: "licensing",
    status: "inProgress",
    name: "partners.entry.cbl.name",
    role: "partners.entry.cbl.role",
    means: "partners.entry.cbl.means",
    next: "partners.entry.cbl.next",
  },
  {
    id: "banks",
    stage: "banking",
    status: "discussion",
    name: "partners.entry.banks.name",
    role: "partners.entry.banks.role",
    means: "partners.entry.banks.means",
    next: "partners.entry.banks.next",
  },
  {
    id: "visa",
    stage: "pipeline",
    status: "pipeline",
    wordmark: "Visa",
    role: "partners.entry.visa.role",
    means: "partners.entry.visa.means",
    next: "partners.entry.visa.next",
  },
  {
    id: "banxa",
    stage: "pipeline",
    status: "pipeline",
    wordmark: "Banxa",
    role: "partners.entry.banxa.role",
    means: "partners.entry.banxa.means",
    next: "partners.entry.banxa.next",
  },
  {
    id: "cryptocom",
    stage: "pipeline",
    status: "pipeline",
    wordmark: "Crypto.com",
    role: "partners.entry.cryptocom.role",
    means: "partners.entry.cryptocom.means",
    next: "partners.entry.cryptocom.next",
  },
];

/* ─────────────────────────────────────────────────────────────────────────── */

function PartnersContent() {
  const { t } = useTranslate();
  const { open } = useWaitlist();

  const pains = [
    { pain: t("partners.pains.1.pain"), fix: t("partners.pains.1.fix") },
    { pain: t("partners.pains.2.pain"), fix: t("partners.pains.2.fix") },
    { pain: t("partners.pains.3.pain"), fix: t("partners.pains.3.fix") },
    { pain: t("partners.pains.4.pain"), fix: t("partners.pains.4.fix") },
  ];

  const chapters: Chapter[] = [
    {
      id: "unlock-banks",
      eyebrow: t("partners.unlock.banks.eyebrow"),
      pain: t("partners.unlock.banks.pain"),
      title: t("partners.unlock.banks.title"),
      body: t("partners.unlock.banks.body"),
      status: "inApp",
      media: { screen: "topup", alt: t("partners.unlock.banks.alt") },
      extra: <SiteButton variant="link" href="#partner-banks" arrow>{t("partners.unlock.banks.link")}</SiteButton>,
    },
    {
      id: "unlock-remit",
      eyebrow: t("partners.unlock.remit.eyebrow"),
      pain: t("partners.unlock.remit.pain"),
      title: t("partners.unlock.remit.title"),
      body: t("partners.unlock.remit.body"),
      status: "pilot",
      media: { video: "flow-remit", screen: "remit-track", alt: t("partners.unlock.remit.alt") },
      extra: <SiteButton variant="link" href="/contact" arrow>{t("partners.unlock.remit.link")}</SiteButton>,
    },
    {
      id: "unlock-cards",
      eyebrow: t("partners.unlock.cards.eyebrow"),
      pain: t("partners.unlock.cards.pain"),
      title: t("partners.unlock.cards.title"),
      body: t("partners.unlock.cards.body"),
      status: "planned",
      media: { screen: "cards", alt: t("partners.unlock.cards.alt") },
      extra: <SiteButton variant="link" href="#partner-visa" arrow>{t("partners.unlock.cards.link")}</SiteButton>,
    },
    {
      id: "unlock-dollars",
      eyebrow: t("partners.unlock.dollars.eyebrow"),
      pain: t("partners.unlock.dollars.pain"),
      title: t("partners.unlock.dollars.title"),
      body: t("partners.unlock.dollars.body"),
      status: "inApp",
      media: { video: "flow-buy", screen: "buy", alt: t("partners.unlock.dollars.alt") },
      extra: <SiteButton variant="link" href="#partner-banxa" arrow>{t("partners.unlock.dollars.link")}</SiteButton>,
    },
  ];

  const criteria = [
    { icon: FiAward, title: t("partners.criteria.licensed.title"), body: t("partners.criteria.licensed.body") },
    { icon: FiMapPin, title: t("partners.criteria.local.title"), body: t("partners.criteria.local.body") },
    { icon: FiLock, title: t("partners.criteria.safeguarding.title"), body: t("partners.criteria.safeguarding.body") },
    { icon: FiShield, title: t("partners.criteria.aml.title"), body: t("partners.criteria.aml.body") },
    { icon: FiMessageCircle, title: t("partners.criteria.arabic.title"), body: t("partners.criteria.arabic.body") },
    { icon: FiRepeat, title: t("partners.criteria.reconcile.title"), body: t("partners.criteria.reconcile.body") },
  ];

  const who = [
    { title: t("partners.forPartners.who.banks.title"), body: t("partners.forPartners.who.banks.body") },
    { title: t("partners.forPartners.who.psps.title"), body: t("partners.forPartners.who.psps.body") },
    { title: t("partners.forPartners.who.issuers.title"), body: t("partners.forPartners.who.issuers.body") },
    { title: t("partners.forPartners.who.remittance.title"), body: t("partners.forPartners.who.remittance.body") },
    { title: t("partners.forPartners.who.liquidity.title"), body: t("partners.forPartners.who.liquidity.body") },
  ];

  const bring = [
    { icon: FiSmartphone, title: t("partners.forPartners.bring.app.title"), body: t("partners.forPartners.bring.app.body") },
    { icon: FiUserCheck, title: t("partners.forPartners.bring.kyc.title"), body: t("partners.forPartners.bring.kyc.body") },
    { icon: FiLayers, title: t("partners.forPartners.bring.ledger.title"), body: t("partners.forPartners.bring.ledger.body") },
    { icon: FiSliders, title: t("partners.forPartners.bring.cockpit.title"), body: t("partners.forPartners.bring.cockpit.body") },
    { icon: FiShield, title: t("partners.forPartners.bring.compliance.title"), body: t("partners.forPartners.bring.compliance.body") },
    { icon: FiCode, title: t("partners.forPartners.bring.api.title"), body: t("partners.forPartners.bring.api.body") },
  ];

  return (
    <>
      <PageHero
        eyebrow={t("partners.hero.eyebrow")}
        title={t("partners.hero.title")}
        lead={t("partners.hero.lead")}
        actions={
          <>
            <SiteButton size="lg" onClick={open} arrow>{t("common.cta.primary")}</SiteButton>
            <SiteButton size="lg" variant="secondary" href="#status">{t("partners.hero.secondary")}</SiteButton>
          </>
        }
        note={t("partners.hero.note")}
        visual={<StageRail stages={STAGES} entries={PARTNERS} label={t("partners.rail.label")} />}
      />

      {/* Why the rails matter */}
      <Section>
        <Container>
          <SectionHeader
            eyebrow={t("partners.pains.eyebrow")}
            title={t("partners.pains.title")}
            lead={t("partners.pains.lead")}
          />
          <PainColumns pain={t("partners.pains.colPain")} fix={t("partners.pains.colFix")} />
          <PainList items={pains} />
        </Container>
      </Section>

      {/* Where every relationship stands */}
      <Section rule id="status">
        <Container>
          <SectionHeader
            eyebrow={t("partners.status.eyebrow")}
            title={t("partners.status.title")}
            lead={t("partners.status.lead")}
            actions={<Dateline label={t("partners.status.updated")} date={t("partners.status.date")} dateTime={REVIEWED} />}
            mb="clamp(40px, 5vw, 64px)"
          />
          <PartnerTimeline
            stages={STAGES}
            entries={PARTNERS}
            labels={{ means: t("partners.entry.meansLabel"), next: t("partners.entry.nextLabel") }}
          />
          <Footnote mt="28px" maxW="80ch">{t("partners.footnote.trademarks")}</Footnote>
          <Footnote mt="8px" maxW="80ch">{t("partners.footnote.status")}</Footnote>
        </Container>
      </Section>

      {/* What the rails switch on, in the real app */}
      <Section rule>
        <Container>
          <SectionHeader
            eyebrow={t("partners.unlock.eyebrow")}
            title={t("partners.unlock.title")}
            lead={t("partners.unlock.lead")}
            mb="clamp(40px, 6vw, 72px)"
          />
          <StoryScroll chapters={chapters} />
          <Footnote mt="40px" align="center">{t("common.media.illustrative")}</Footnote>
        </Container>
      </Section>

      {/* How we choose */}
      <Section rule>
        <Container>
          <SectionHeader
            eyebrow={t("partners.criteria.eyebrow")}
            title={t("partners.criteria.title")}
            lead={t("partners.criteria.lead")}
            mb="clamp(40px, 5vw, 64px)"
          />
          <FeatureGrid items={criteria} columns={3} />
        </Container>
      </Section>

      {/* For partners */}
      <Section rule id="work-with-us">
        <Container>
          <SectionHeader
            eyebrow={t("partners.forPartners.eyebrow")}
            title={t("partners.forPartners.title")}
            lead={t("partners.forPartners.lead")}
            mb="clamp(40px, 5vw, 64px)"
          />
          <ForPartners
            whoLabel={t("partners.forPartners.whoLabel")}
            who={who}
            bringLabel={t("partners.forPartners.bringLabel")}
            bring={bring}
            cta={{ label: t("partners.forPartners.cta"), href: "/contact" }}
          />
        </Container>
      </Section>

      <CTABand title={t("partners.cta.title")} />
    </>
  );
}

export default function PartnersPage() {
  return (
    <SiteShell>
      <PartnersContent />
    </SiteShell>
  );
}
