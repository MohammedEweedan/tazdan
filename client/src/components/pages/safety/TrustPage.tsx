"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   /trust — the trust centre: a calm index of where tazdan stands and where
   to read more. Statuses live in ONE array (TRUST_ITEMS) so the owner can
   flip one when something changes (e.g. a licence is granted).
   Truth rules: pre-launch, not licensed, no safeguarding accounts yet, no
   deposit protection, no completed external audit (docs/SECURITY.md "Not
   yet done", regulatory/CUSTOMER_FUNDS.md "Gaps").
   ═══════════════════════════════════════════════════════════════════════════ */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import {
  FiAlertTriangle, FiBookOpen, FiCompass, FiEyeOff, FiFileText, FiFlag, FiLayers, FiLock, FiMail, FiShield, FiTrash2, FiUserCheck,
} from "react-icons/fi";
import {
  BentoCard, BentoGrid, Container, CTABand, Footnote, MediaHero, Row, RowList, Section, SectionHeader, SectionLabel,
  SiteButton, StatusChip, useSiteLocale, useSiteTheme, useWaitlist, type Status,
} from "@/components/site";
import { LabelChip } from "./shared";

type TrustItem = { group: "status" | "protection" | "rights"; icon: IconType; title: string; body: string; href: string; status?: Status; label?: string };

/* ── the one place to change a status ───────────────────────────────────── */
const TRUST_ITEMS: TrustItem[] = [
  { group: "status", icon: FiCompass, title: "safety.trust.item.product.title", body: "safety.trust.item.product.body", href: "/features", label: "safety.trust.chip.prelaunch" },
  { group: "status", icon: FiFlag, title: "safety.trust.item.licence.title", body: "safety.trust.item.licence.body", href: "/partners", status: "inProgress" },
  { group: "status", icon: FiLayers, title: "safety.trust.item.safeguarding.title", body: "safety.trust.item.safeguarding.body", href: "/security#partner", status: "planned" },
  { group: "status", icon: FiAlertTriangle, title: "safety.trust.item.audits.title", body: "safety.trust.item.audits.body", href: "/security#not-yet", status: "planned" },
  { group: "protection", icon: FiLock, title: "safety.trust.item.funds.title", body: "safety.trust.item.funds.body", href: "/security#funds", status: "inApp" },
  { group: "protection", icon: FiShield, title: "safety.trust.item.transactions.title", body: "safety.trust.item.transactions.body", href: "/security#transactions", status: "inApp" },
  { group: "protection", icon: FiEyeOff, title: "safety.trust.item.privacy.title", body: "safety.trust.item.privacy.body", href: "/security#privacy", status: "inApp" },
  { group: "protection", icon: FiUserCheck, title: "safety.trust.item.compliance.title", body: "safety.trust.item.compliance.body", href: "/compliance", status: "inApp" },
  { group: "rights", icon: FiFileText, title: "safety.trust.item.privacyPolicy.title", body: "safety.trust.item.privacyPolicy.body", href: "/privacy" },
  { group: "rights", icon: FiBookOpen, title: "safety.trust.item.terms.title", body: "safety.trust.item.terms.body", href: "/terms" },
  { group: "rights", icon: FiAlertTriangle, title: "safety.trust.item.risk.title", body: "safety.trust.item.risk.body", href: "/risk" },
  { group: "rights", icon: FiTrash2, title: "safety.trust.item.delete.title", body: "safety.trust.item.delete.body", href: "/delete-account" },
  { group: "rights", icon: FiShield, title: "safety.trust.item.report.title", body: "safety.trust.item.report.body", href: "/security#report" },
  { group: "rights", icon: FiMail, title: "safety.trust.item.contact.title", body: "safety.trust.item.contact.body", href: "/contact" },
];

const GROUPS = [
  { id: "status", label: "safety.trust.group.status.label", title: "safety.trust.group.status.title" },
  { id: "protection", label: "safety.trust.group.protection.label", title: "safety.trust.group.protection.title" },
  { id: "rights", label: "safety.trust.group.rights.label", title: "safety.trust.group.rights.title" },
] as const;

function TrustContent() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const { forward } = useSiteLocale();
  const { open } = useWaitlist();

  const chip = (it: TrustItem) =>
    it.status ? <StatusChip status={it.status} /> : it.label ? <LabelChip label={t(it.label)} tone="amber" /> : null;

  const disclosures = [
    t("safety.trust.disclosure.1"), t("safety.trust.disclosure.2"), t("safety.trust.disclosure.3"), t("safety.trust.disclosure.4"),
    t("safety.trust.disclosure.5"), t("safety.trust.disclosure.6"), t("safety.trust.disclosure.7"),
  ];

  return <>
    <MediaHero
      compact
      eyebrow={t("safety.trust.hero.eyebrow")}
      title={t("safety.trust.hero.title")}
      lead={t("safety.trust.hero.lead")}
      actions={<>
        <SiteButton size="lg" onClick={open} arrow>{t("common.cta.primary")}</SiteButton>
        <SiteButton size="lg" variant="secondary" href="/security">{t("safety.trust.hero.secondary")}</SiteButton>
      </>}
      note={t("safety.trust.hero.note")}
    />

    {/* three headline states */}
    <Section tight pt={0}>
      <Container>
        <BentoGrid>
          <BentoCard span={2} icon={FiCompass} title={t("safety.trust.glance.product.title")} body={t("safety.trust.glance.product.body")}>
            <Box mt="16px"><LabelChip label={t("safety.trust.chip.prelaunch")} tone="amber" /></Box>
          </BentoCard>
          <BentoCard span={2} icon={FiFlag} status="inProgress" title={t("safety.trust.glance.licence.title")} body={t("safety.trust.glance.licence.body")}
            link={{ href: "/partners", label: t("safety.trust.glance.licence.link") }} />
          <BentoCard span={2} icon={FiLock} status="inApp" title={t("safety.trust.glance.funds.title")} body={t("safety.trust.glance.funds.body")}
            link={{ href: "/security#funds", label: t("safety.trust.glance.funds.link") }} />
        </BentoGrid>
      </Container>
    </Section>

    {GROUPS.map((g) => (
      <Section key={g.id} id={g.id} rule tight>
        <Container>
          <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,0.75fr) minmax(0,1.25fr)" }} gap="clamp(20px, 5vw, 80px)" alignItems="start">
            <Box position={{ lg: "sticky" }} top="110px">
              <SectionLabel mb="12px">{t(g.label)}</SectionLabel>
              <SectionHeader layout="stack" title={t(g.title)} />
            </Box>
            <RowList>
              {TRUST_ITEMS.filter((it) => it.group === g.id).map((it) => (
                <Row key={it.title} icon={it.icon} href={it.href} body={t(it.body)} padX="12px" borderRadius="14px"
                  title={<Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
                    {t(it.title)}
                    {(it.status || it.label) && <Box display={{ base: "inline-flex", sm: "none" }}>{chip(it)}</Box>}
                  </Box>}
                  trailing={<Box display="flex" alignItems="center" gap="12px">
                    <Box display={{ base: "none", sm: "block" }}>{chip(it)}</Box>
                    <Box as="span" aria-hidden color={theme.fgFaint}>{forward}</Box>
                  </Box>} />
              ))}
            </RowList>
          </Box>
        </Container>
      </Section>
    ))}

    <Section id="disclosures" rule>
      <Container narrow>
        <SectionHeader layout="stack" eyebrow={t("safety.trust.disclosures.eyebrow")} title={t("safety.trust.disclosures.title")} />
        <Box as="ol" listStyleType="none" mt="32px" borderTop="1px solid" borderColor={theme.border}>
          {disclosures.map((d, i) => (
            <Box as="li" key={i} display="flex" gap="18px" py="18px" borderBottom="1px solid" borderColor={theme.border}>
              <Box fontSize="13px" fontWeight={600} color={theme.accentText} pt="3px" minW="22px" sx={{ fontVariantNumeric: "tabular-nums" }} dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </Box>
              <Box as="p" fontSize="15.5px" lineHeight={1.65} color={theme.fgMuted} style={{ textAlign: "start" }}>{d}</Box>
            </Box>
          ))}
        </Box>
        <Footnote mt="22px">{t("safety.trust.updated")}</Footnote>
      </Container>
    </Section>

    <CTABand title={t("safety.trust.cta.title")} lead={t("safety.trust.cta.lead")} secondary={{ label: t("safety.trust.cta.secondary"), href: "/contact" }} />
  </>;
}

export default function TrustPage() {
  return <TrustContent />;
}
