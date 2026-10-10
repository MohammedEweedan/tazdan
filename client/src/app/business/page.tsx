"use client";

import { useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiCode, FiCopy, FiCreditCard, FiKey, FiLayers, FiShield, FiUsers } from "react-icons/fi";
import {
  Body, Container, CTABand, Eyebrow, FAQList, FeatureGrid, Footnote, Headline, Lead,
  PageHero, PainList, PhoneStage, Section, SectionHeader, SiteButton, SiteShell,
  Stat, StoryScroll, useSiteTheme, useWaitlist, type Chapter,
} from "@/components/site";
import { PAYOUT_REQUEST, PAYOUT_RESPONSE, WEBHOOK_VERIFY, WEBHOOK_EVENTS } from "@/components/pages/business/codeSamples";

const STORY = [
  { id: "kyb", media: "business-home", pointCount: 3 },
  { id: "team", media: "business-team", pointCount: 0 },
  { id: "bulk", media: "business-bulk", pointCount: 4 },
  { id: "approval", media: "business-approval", pointCount: 4 },
  { id: "payouts", media: "business-payouts", pointCount: 3 },
  { id: "keys", media: "business-keys", pointCount: 3 },
] as const;

function CodeDemo() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const samples = [PAYOUT_REQUEST, PAYOUT_RESPONSE, WEBHOOK_VERIFY];
  const names = ["request", "response", "webhook"];
  const copy = async () => {
    await navigator.clipboard.writeText(samples[tab]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return <Box borderTop="1px solid" borderColor={theme.border} pt="20px">
    <Box display="flex" alignItems="center" gap="8px" flexWrap="wrap" role="tablist" aria-label={t("business.dev.tabs")}>
      {names.map((name, i) => <Box key={name} as="button" type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} minH="44px" px="14px" borderRadius="999px" bg={tab === i ? theme.fg : "transparent"} color={tab === i ? theme.bg : theme.fgMuted} border="1px solid" borderColor={tab === i ? theme.fg : theme.border}>{t(`business.dev.tab.${name}`)}</Box>)}
      <Box as="button" type="button" onClick={copy} minH="44px" px="14px" display="inline-flex" alignItems="center" gap="7px" color={theme.accentText} sx={{ marginInlineStart: "auto" }}>
        {copied ? <FiCheck /> : <FiCopy />}{t(copied ? "business.dev.copied" : "business.dev.copy")}
      </Box>
    </Box>
    <Box as="pre" mt="18px" p="clamp(18px, 3vw, 32px)" bg={theme.bgElev} border="1px solid" borderColor={theme.border} borderRadius="18px" overflowX="auto" color={theme.fg} fontSize="12.5px" lineHeight={1.65} dir="ltr"><code>{samples[tab]}</code></Box>
    <Footnote mt="14px">{t(`business.dev.caption.${names[tab]}`)}</Footnote>
  </Box>;
}

function BusinessContent() {
  const { t } = useTranslate();
  const { open } = useWaitlist();
  const theme = useSiteTheme();
  const chapters: Chapter[] = STORY.map(({ id, media, pointCount }) => ({
    id,
    eyebrow: t(`business.story.${id}.eyebrow`),
    pain: id === "kyb" ? undefined : t(`business.story.${id}.pain`),
    title: t(`business.story.${id}.title`),
    body: t(`business.story.${id}.body`),
    points: Array.from({ length: pointCount }, (_, i) => ({ text: t(`business.story.${id}.p${i + 1}`) })),
    status: "inApp",
    media: { screen: media, alt: t(`business.media.${id}`) },
  }));
  const pains = Array.from({ length: 6 }, (_, i) => ({ pain: t(`business.pains.p${i + 1}.pain`), fix: t(`business.pains.p${i + 1}.fix`) }));
  const controls = [1, 2, 3, 4, 5, 6].map((i) => ({ icon: [FiUsers, FiLayers, FiKey, FiCode, FiShield, FiCreditCard][i - 1], title: t(`business.controls.c${i}.title`), body: t(`business.controls.c${i}.body`) }));
  const apiCaps = ["balances", "rates", "payouts", "webhooks"].map((id) => ({ title: t(`business.dev.cap.${id}.title`), body: t(`business.dev.cap.${id}.body`) }));
  const notYet = ["bank", "invoices", "upload", "portal"].map((id) => ({ title: t(`business.notyet.${id}.title`), body: t(`business.notyet.${id}.body`) }));
  const faqs = [1, 2, 3, 4, 5, 6].map((i) => ({ q: t(`business.faq.q${i}`), a: t(`business.faq.a${i}`) }));
  return <>
    <PageHero align="split" eyebrow={t("business.hero.eyebrow")} title={t("business.hero.title")} lead={t("business.hero.lead")}
      actions={<><SiteButton size="lg" onClick={open} arrow>{t("business.hero.primary")}</SiteButton><SiteButton size="lg" variant="secondary" href="/contact">{t("business.hero.secondary")}</SiteButton></>}
      note={t("business.hero.note")}
      visual={<PhoneStage items={[{ screen: "business-home", alt: t("business.media.hero") }]} index={0} w="min(310px, 75vw)" />} />
    <Section rule><Container>
      <SectionHeader eyebrow={t("business.pains.eyebrow")} title={t("business.pains.title")} lead={t("business.pains.lead")} />
      <Box mt="clamp(36px, 5vw, 72px)"><PainList items={pains} /></Box>
    </Container></Section>
    <Section rule><Container>
      <Box display="grid" gridTemplateColumns={{ base: "repeat(2,1fr)", lg: "repeat(4,1fr)" }} gap="24px">
        <Stat value="500" label={t("business.stats.batch")} />
        <Stat value="2" label={t("business.stats.approvers")} note={t("business.stats.approversNote")} />
        <Stat value="4" label={t("business.stats.roles")} />
        <Stat value="7" label={t("business.stats.events")} />
      </Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("business.story.eyebrow")} title={t("business.story.title")} lead={t("business.story.lead")} />
      <Box mt="clamp(52px, 7vw, 100px)"><StoryScroll chapters={chapters} /></Box>
      <Footnote mt="36px">{t("common.media.illustrative")}</Footnote>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("business.controls.eyebrow")} title={t("business.controls.title")} lead={t("business.controls.lead")} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={controls} /></Box>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("business.dev.eyebrow")} title={t("business.dev.title")} lead={t("business.dev.lead")} />
      <Box mt="clamp(36px, 5vw, 72px)"><CodeDemo /></Box>
      <Footnote mt="18px">{t("business.dev.base")}</Footnote>
      <Eyebrow mt="60px" mb="26px">{t("business.dev.cap.label")}</Eyebrow>
      <FeatureGrid items={apiCaps} columns={4} />
      <Eyebrow mt="54px" mb="14px">{t("business.dev.events.label")}</Eyebrow>
      <Box display="flex" gap="8px" flexWrap="wrap">{WEBHOOK_EVENTS.map((e) => <Box key={e} px="12px" py="8px" border="1px solid" borderColor={theme.border} borderRadius="999px" fontFamily="mono" fontSize="13px" color={theme.fgMuted}>{e}</Box>)}</Box>
      <Eyebrow mt="52px">{t("business.dev.auth.label")}</Eyebrow><Body mt="10px" maxW="72ch">{t("business.dev.auth.body")}</Body>
    </Container></Section>
    <Section rule><Container>
      <SectionHeader eyebrow={t("business.notyet.eyebrow")} title={t("business.notyet.title")} lead={t("business.notyet.lead")} />
      <Box mt="clamp(36px, 5vw, 72px)"><FeatureGrid items={notYet.map((i) => ({ ...i, status: "planned" as const }))} columns={4} /></Box>
    </Container></Section>
    <Section rule><Container narrow>
      <SectionHeader eyebrow={t("business.faq.eyebrow")} title={t("business.faq.title")} layout="stack" />
      <Box mt="36px"><FAQList items={faqs} /></Box>
    </Container></Section>
    <CTABand title={t("business.cta.title")} lead={t("business.cta.lead")} />
  </>;
}

export default function BusinessPage() { return <SiteShell><BusinessContent /></SiteShell>; }
