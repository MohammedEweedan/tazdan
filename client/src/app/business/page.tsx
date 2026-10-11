"use client";

/* /business — tazdan Business, told through a Libyan SME owner's payday.
   Every claim maps to code: server/src/services/business/* (access, payouts,
   apiKeys, webhooks), routes/business.ts + routes/publicApi.ts, and the app's
   mobile/app/business/* screens. "Invoices" in the app is a payouts record
   (mobile/app/business/invoices.tsx), so invoicing is listed as not built. */

import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiActivity, FiGlobe, FiKey, FiLock, FiServer, FiUsers } from "react-icons/fi";
import {
  Container, CTABand, FAQList, FeatureGrid, Footnote, MONO, PageHero, PainList, PhoneStage,
  Row, RowList, Section, SectionHeader, SectionLabel, SiteButton, SiteShell, Stat, StatusChip,
  StoryScroll, Body, useSiteTheme, useWaitlist, type Chapter,
} from "@/components/site";
import CodeSample, { MONO_SX } from "@/components/pages/business/CodeSample";
import RoleTable from "@/components/pages/business/RoleTable";
import { WEBHOOK_EVENTS } from "@/components/pages/business/codeSamples";

function NotBuiltTag({ label }: { label: string }) {
  const t = useSiteTheme();
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="7px"
      h="24px"
      px="10px"
      borderRadius="999px"
      border="1px dashed"
      borderColor={t.borderStrong}
      fontSize="12px"
      fontWeight={500}
      color={t.fgMuted}
      whiteSpace="nowrap"
    >
      <Box as="span" w="6px" h="6px" borderRadius="999px" border="1px solid" borderColor={t.fgFaint} aria-hidden />
      {label}
    </Box>
  );
}

function BusinessContent() {
  const { t } = useTranslate();
  const { open } = useWaitlist();
  const theme = useSiteTheme();

  const pains = [
    { pain: t("business.pains.p1.pain"), fix: t("business.pains.p1.fix") },
    { pain: t("business.pains.p2.pain"), fix: t("business.pains.p2.fix") },
    { pain: t("business.pains.p3.pain"), fix: t("business.pains.p3.fix") },
    { pain: t("business.pains.p4.pain"), fix: t("business.pains.p4.fix") },
    { pain: t("business.pains.p5.pain"), fix: t("business.pains.p5.fix") },
    { pain: t("business.pains.p6.pain"), fix: t("business.pains.p6.fix") },
  ];

  const chapters: Chapter[] = [
    {
      id: "verify",
      eyebrow: t("business.story.kyb.eyebrow"),
      title: t("business.story.kyb.title"),
      body: t("business.story.kyb.body"),
      points: [{ text: t("business.story.kyb.p1") }, { text: t("business.story.kyb.p2") }, { text: t("business.story.kyb.p3") }],
      status: "inApp",
      media: { screen: "business-home", alt: t("business.media.kyb") },
    },
    {
      id: "team",
      eyebrow: t("business.story.team.eyebrow"),
      pain: t("business.story.team.pain"),
      title: t("business.story.team.title"),
      body: t("business.story.team.body"),
      status: "inApp",
      media: { screen: "business-team", alt: t("business.media.team") },
      extra: <RoleTable />,
    },
    {
      id: "bulk-pay",
      eyebrow: t("business.story.bulk.eyebrow"),
      pain: t("business.story.bulk.pain"),
      title: t("business.story.bulk.title"),
      body: t("business.story.bulk.body"),
      points: [
        { text: t("business.story.bulk.p1") }, { text: t("business.story.bulk.p2") },
        { text: t("business.story.bulk.p3") }, { text: t("business.story.bulk.p4") },
      ],
      status: "inApp",
      media: { screen: "business-bulk", alt: t("business.media.bulk") },
    },
    {
      id: "approvals",
      eyebrow: t("business.story.approval.eyebrow"),
      pain: t("business.story.approval.pain"),
      title: t("business.story.approval.title"),
      body: t("business.story.approval.body"),
      points: [
        { text: t("business.story.approval.p1") }, { text: t("business.story.approval.p2") },
        { text: t("business.story.approval.p3") }, { text: t("business.story.approval.p4") },
      ],
      status: "inApp",
      media: { screen: "business-approval", alt: t("business.media.approval") },
    },
    {
      id: "payouts",
      eyebrow: t("business.story.payouts.eyebrow"),
      pain: t("business.story.payouts.pain"),
      title: t("business.story.payouts.title"),
      body: t("business.story.payouts.body"),
      points: [{ text: t("business.story.payouts.p1") }, { text: t("business.story.payouts.p2") }, { text: t("business.story.payouts.p3") }],
      status: "inApp",
      media: { screen: "business-payouts", alt: t("business.media.payouts") },
    },
    {
      id: "api-keys",
      eyebrow: t("business.story.keys.eyebrow"),
      pain: t("business.story.keys.pain"),
      title: t("business.story.keys.title"),
      body: t("business.story.keys.body"),
      points: [{ text: t("business.story.keys.p1") }, { text: t("business.story.keys.p2") }, { text: t("business.story.keys.p3") }],
      status: "inApp",
      media: { screen: "business-keys", alt: t("business.media.keys") },
    },
  ];

  const apiCaps = [
    { title: t("business.dev.cap.balances.title"), body: t("business.dev.cap.balances.body"), endpoints: ["GET /api/v1/balances"] },
    { title: t("business.dev.cap.rates.title"), body: t("business.dev.cap.rates.body"), endpoints: ["GET /api/v1/rates?base=USD&quote=LYD"] },
    {
      title: t("business.dev.cap.payouts.title"), body: t("business.dev.cap.payouts.body"),
      endpoints: ["POST /api/v1/payouts", "GET /api/v1/payouts", "GET /api/v1/payouts/:id", "GET /api/v1/batches/:id"],
    },
    { title: t("business.dev.cap.webhooks.title"), body: t("business.dev.cap.webhooks.body"), endpoints: ["GET · POST /api/v1/webhooks", "DELETE /api/v1/webhooks/:id"] },
  ];

  const controls = [
    { icon: FiUsers, title: t("business.controls.c1.title"), body: t("business.controls.c1.body") },
    { icon: FiLock, title: t("business.controls.c2.title"), body: t("business.controls.c2.body") },
    { icon: FiKey, title: t("business.controls.c3.title"), body: t("business.controls.c3.body") },
    { icon: FiServer, title: t("business.controls.c4.title"), body: t("business.controls.c4.body") },
    { icon: FiGlobe, title: t("business.controls.c5.title"), body: t("business.controls.c5.body") },
    { icon: FiActivity, title: t("business.controls.c6.title"), body: t("business.controls.c6.body") },
  ];

  const notYet = [
    { title: t("business.notyet.bank.title"), body: t("business.notyet.bank.body"), link: { href: "/features", label: t("business.notyet.bank.link") } },
    { title: t("business.notyet.invoices.title"), body: t("business.notyet.invoices.body") },
    { title: t("business.notyet.upload.title"), body: t("business.notyet.upload.body") },
    { title: t("business.notyet.portal.title"), body: t("business.notyet.portal.body"), link: { href: "/contact", label: t("business.hero.secondary") } },
  ];

  const faqs = [
    { q: t("business.faq.q1"), a: t("business.faq.a1") },
    { q: t("business.faq.q2"), a: t("business.faq.a2") },
    { q: t("business.faq.q3"), a: t("business.faq.a3") },
    { q: t("business.faq.q4"), a: t("business.faq.a4") },
    { q: t("business.faq.q5"), a: t("business.faq.a5") },
    { q: t("business.faq.q6"), a: t("business.faq.a6") },
  ];

  return (
    <>
      <PageHero
        align="split"
        eyebrow={t("business.hero.eyebrow")}
        title={t("business.hero.title")}
        lead={t("business.hero.lead")}
        actions={
          <>
            <SiteButton size="lg" onClick={open} arrow>{t("business.hero.primary")}</SiteButton>
            <SiteButton size="lg" variant="secondary" href="/contact">{t("business.hero.secondary")}</SiteButton>
          </>
        }
        note={t("business.hero.note")}
        visual={
          <PhoneStage
            items={[{ video: "flow-business", screen: "business-home", alt: t("business.media.hero") }]}
            index={0}
            priority
            w="min(310px, 74vw)"
          />
        }
      />

      {/* The pain */}
      <Section rule>
        <Container>
          <SectionHeader eyebrow={t("business.pains.eyebrow")} title={t("business.pains.title")} lead={t("business.pains.lead")} />
          <Box mt="clamp(36px, 5vw, 64px)"><PainList items={pains} /></Box>
          <Box
            mt="clamp(56px, 7vw, 96px)"
            display="grid"
            gridTemplateColumns={{ base: "repeat(2, minmax(0,1fr))", lg: "repeat(4, minmax(0,1fr))" }}
            columnGap="clamp(20px, 3vw, 44px)"
            rowGap="32px"
          >
            <Stat value="500" label={t("business.stats.batch")} />
            <Stat value="2" label={t("business.stats.approvers")} note={t("business.stats.approversNote")} />
            <Stat value="4" label={t("business.stats.roles")} />
            <Stat value="7" label={t("business.stats.events")} />
          </Box>
        </Container>
      </Section>

      {/* The story */}
      <Section rule>
        <Container>
          <SectionHeader eyebrow={t("business.story.eyebrow")} title={t("business.story.title")} lead={t("business.story.lead")} />
          <Box mt="clamp(48px, 7vw, 96px)"><StoryScroll chapters={chapters} /></Box>
          <Footnote mt="40px">{t("common.media.illustrative")}</Footnote>
        </Container>
      </Section>

      {/* Developers */}
      <Section rule id="developers">
        <Container>
          <SectionHeader eyebrow={t("business.dev.eyebrow")} title={t("business.dev.title")} lead={t("business.dev.lead")} />
          <Box
            mt="clamp(40px, 5vw, 72px)"
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,7fr) minmax(0,5fr)" }}
            gap="clamp(40px, 5vw, 72px)"
            alignItems="start"
          >
            <Box minW={0}>
              <CodeSample />
              <Footnote mt="10px" maxW="68ch">{t("business.dev.base")}</Footnote>
            </Box>
            <Box minW={0}>
              <SectionLabel mb="6px">{t("business.dev.cap.label")}</SectionLabel>
              <RowList>
                {apiCaps.map((c) => (
                  <Row
                    key={c.title}
                    title={
                      <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
                        {c.title}
                        <StatusChip status="inApp" />
                      </Box>
                    }
                    body={
                      <>
                        {c.body}
                        <Box as="span" display="block" mt="8px" dir="ltr" style={{ textAlign: "start" }}>
                          {c.endpoints.map((e) => (
                            <Box as="code" key={e} display="block" fontFamily={MONO} sx={MONO_SX} fontSize="12.5px" color={theme.fgFaint} lineHeight={1.8} overflowWrap="anywhere">
                              {e}
                            </Box>
                          ))}
                        </Box>
                      </>
                    }
                  />
                ))}
              </RowList>
            </Box>
          </Box>

          <Box
            mt="clamp(48px, 6vw, 80px)"
            display="grid"
            gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,7fr) minmax(0,5fr)" }}
            gap="clamp(32px, 5vw, 72px)"
          >
            <Box borderTop="1px solid" borderColor={theme.divider} pt="22px" minW={0}>
              <SectionLabel mb="14px">{t("business.dev.events.label")}</SectionLabel>
              <Box display="flex" gap="8px" flexWrap="wrap" dir="ltr">
                {WEBHOOK_EVENTS.map((e) => (
                  <Box key={e} as="code" px="12px" py="6px" border="1px solid" borderColor={theme.border} borderRadius="999px" fontFamily={MONO} sx={MONO_SX} fontSize="12.5px" color={theme.fgMuted}>
                    {e}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box borderTop="1px solid" borderColor={theme.divider} pt="22px" minW={0}>
              <SectionLabel mb="10px">{t("business.dev.auth.label")}</SectionLabel>
              <Body fontSize="15px">{t("business.dev.auth.body")}</Body>
            </Box>
          </Box>
        </Container>
      </Section>

      {/* Controls */}
      <Section rule>
        <Container>
          <SectionHeader eyebrow={t("business.controls.eyebrow")} title={t("business.controls.title")} lead={t("business.controls.lead")} />
          <Box mt="clamp(40px, 5vw, 72px)"><FeatureGrid items={controls} columns={3} /></Box>
        </Container>
      </Section>

      {/* Not built yet */}
      <Section rule>
        <Container>
          <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,5fr) minmax(0,7fr)" }} gap="clamp(28px, 5vw, 72px)" alignItems="start">
            <SectionHeader layout="stack" eyebrow={t("business.notyet.eyebrow")} title={t("business.notyet.title")} lead={t("business.notyet.lead")} />
            <RowList borderTop="1px solid" borderBottom="1px solid" borderColor={theme.border}>
              {notYet.map((n) => (
                <Row
                  key={n.title}
                  py="22px"
                  title={
                    <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
                      {n.title}
                      <NotBuiltTag label={t("business.notyet.tag")} />
                    </Box>
                  }
                  body={
                    <>
                      {n.body}
                      {n.link && (
                        <Box as="span" display="block" mt="10px">
                          <SiteButton variant="link" href={n.link.href} arrow>{n.link.label}</SiteButton>
                        </Box>
                      )}
                    </>
                  }
                />
              ))}
            </RowList>
          </Box>
        </Container>
      </Section>

      {/* FAQ */}
      <Section rule>
        <Container>
          <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,5fr) minmax(0,7fr)" }} gap="clamp(28px, 5vw, 72px)" alignItems="start">
            <SectionHeader layout="stack" eyebrow={t("business.faq.eyebrow")} title={t("business.faq.title")} />
            <FAQList items={faqs} />
          </Box>
        </Container>
      </Section>

      <CTABand title={t("business.cta.title")} lead={t("business.cta.lead")} />
    </>
  );
}

export default function BusinessPage() {
  return (
    <SiteShell>
      <BusinessContent />
    </SiteShell>
  );
}
