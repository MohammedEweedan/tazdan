"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  Body, Container, CTABand, Eyebrow, FeatureGrid, Footnote, Headline, Lead,
  PageHero, PhoneStage, Section, SiteButton, SiteShell, StatusChip,
  useSiteTheme, useWaitlist, type Status,
} from "@/components/site";
import enFeatures from "@/i18n/site/features/en.json";

const SECTIONS = [
  { id: "accounts", media: { onboarding: "onboarding", balances: "home", wallet: "wallet", asset: "asset", portfolio: "portfolio" } },
  { id: "move", media: { send: "send", confirm: "confirm", receive: "receive", claim: "claim", topup: "topup", withdraw: "withdraw" } },
  { id: "abroad", media: { home: "remit", quote: "remit", track: "remit-track" } },
  { id: "exchange", media: { convert: "buy", buy: "buy", sell: "sell", recurring: "recurring" } },
  { id: "p2p", media: { market: "p2p", near: "p2p", trade: "chat-payment" } },
  { id: "save", media: { goals: "budgets", detail: "budgets", new: "budgets" } },
  { id: "messages", media: { inbox: "messages", payment: "chat-payment", contact: "contact" } },
  { id: "cards", media: { cards: "cards" } },
  { id: "security", media: { kyc: "kyc", limits: "kyc", stepup: "twofa", twofa: "twofa", devices: "devices", privacy: "settings" } },
  { id: "extras", media: { statements: "statements", history: "history", notifications: "history", linked: "linked", handle: "contact", settings: "settings" } },
  { id: "business", media: { home: "business-home", bulk: "business-bulk", keys: "business-keys" } },
] as const;

type FeatureId = typeof SECTIONS[number]["id"];
const english = enFeatures as Record<string, string>;
const key = (id: string, part: string) => `features.${id}.${part}`;
const tabsFor = (id: string) => Object.keys(english).filter((k) => k.startsWith(key(id, "tab."))).map((k) => k.split(".").at(-1)!);
const capsFor = (id: string) => Array.from(new Set(Object.keys(english).filter((k) => k.startsWith(key(id, "cap."))).map((k) => k.split(".")[3])));
function capStatus(section: FeatureId, cap: string): Status {
  if (section === "abroad") return "pilot";
  if (section === "cards") return "planned";
  if (["phone", "apple"].includes(cap) && section === "accounts") return "planned";
  if (["topupCard", "topupAgent"].includes(cap) && section === "move") return "planned";
  if (cap === "recurringCard" && section === "exchange") return "planned";
  return "inApp";
}

function MediaTabs({ section }: { section: typeof SECTIONS[number] }) {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const tabs = tabsFor(section.id);
  const [selected, setSelected] = useState(0);
  const tab = tabs[selected] ?? tabs[0];
  const screen = (section.media as Record<string, string>)[tab] ?? "home";
  return <Box>
    <Box display="flex" gap="8px" flexWrap="wrap" mb="26px" role="tablist" aria-label={t("features.switcher.label")}>
      {tabs.map((item, i) => <Box
        as="button" type="button" role="tab" key={item} aria-selected={selected === i}
        onClick={() => setSelected(i)} minH="44px" px="14px" borderRadius="999px"
        bg={selected === i ? theme.fg : "transparent"} color={selected === i ? theme.bg : theme.fgMuted}
        border="1px solid" borderColor={selected === i ? theme.fg : theme.border}
        _focusVisible={{ outline: `2px solid ${theme.accent}`, outlineOffset: "2px" }}
      >{t(key(section.id, `tab.${item}`))}</Box>)}
    </Box>
    <Box display="flex" justifyContent="center" position="relative">
      <Box aria-hidden position="absolute" inset="-16%" bg={theme.glow} pointerEvents="none" />
      <PhoneStage items={[{ screen, alt: t(key(section.id, `alt.${tab}`)) }]} index={0} w="min(290px, 75vw)" />
    </Box>
  </Box>;
}

function CapabilitySection({ section, index }: { section: typeof SECTIONS[number]; index: number }) {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const id = section.id;
  const caps = capsFor(id);
  const overall: Status = id === "abroad" ? "pilot" : id === "cards" ? "planned" : "inApp";
  return <Section id={id} rule>
    <Container>
      <Box display="grid" gridTemplateColumns={{ base: "1fr", lg: "minmax(0,1fr) minmax(0,0.9fr)" }} gap="clamp(50px, 8vw, 120px)" alignItems="center">
        <Box order={{ base: 1, lg: index % 2 ? 2 : 1 }}>
          <Box display="flex" alignItems="center" gap="12px" mb="14px"><Eyebrow>{t(key(id, "nav"))}</Eyebrow><StatusChip status={overall} /></Box>
          <Headline text={t(key(id, "title"))} maxW="18ch" />
          <Body mt="18px" maxW="48ch" color={theme.fgFaint}>{t(key(id, "pain"))}</Body>
          <Lead mt="18px" maxW="44ch">{t(key(id, "lead"))}</Lead>
          {english[key(id, "note")] && <Footnote mt="18px" maxW="52ch">{t(key(id, "note"))}</Footnote>}
          {english[key(id, "link")] && <Box mt="20px"><SiteButton variant="link" href={id === "business" ? "/business" : "/security"} arrow>{t(key(id, "link"))}</SiteButton></Box>}
        </Box>
        <Box order={{ base: 2, lg: index % 2 ? 1 : 2 }}><MediaTabs section={section} /></Box>
      </Box>
      <Box mt="clamp(64px, 8vw, 110px)">
        <FeatureGrid columns={3} items={caps.map((cap) => ({
          title: t(key(id, `cap.${cap}.title`)),
          body: t(key(id, `cap.${cap}.body`)),
          status: capStatus(id, cap),
        }))} />
      </Box>
      <Footnote mt="36px">{t("common.media.illustrative")}</Footnote>
    </Container>
  </Section>;
}

function FeaturesContent() {
  const { t } = useTranslate();
  const { open } = useWaitlist();
  const theme = useSiteTheme();
  return <>
    <PageHero align="split" eyebrow={t("features.hero.eyebrow")} title={t("features.hero.title")}
      lead={t("features.hero.lead")}
      actions={<><SiteButton size="lg" onClick={open} arrow>{t("features.hero.primary")}</SiteButton><SiteButton size="lg" variant="secondary" href="#feature-index">{t("features.hero.secondary")}</SiteButton></>}
      note={t("features.hero.note")}
      visual={<PhoneStage items={[{ screen: "home", alt: t("features.hero.alt") }]} index={0} w="min(300px, 76vw)" />} />
    <Box id="feature-index" borderTop="1px solid" borderBottom="1px solid" borderColor={theme.border}>
      <Container py="34px">
        <Eyebrow mb="14px">{t("features.index.label")}</Eyebrow>
        <Box display="flex" flexWrap="wrap" gap="8px">
          {SECTIONS.map((s) => <Box key={s.id} as={NextLink} href={`#${s.id}`} px="14px" py="9px" minH="44px" border="1px solid" borderColor={theme.border} borderRadius="999px" color={theme.fgMuted} _hover={{ color: theme.fg, borderColor: theme.borderStrong }}>{t(key(s.id, "nav"))}</Box>)}
        </Box>
      </Container>
    </Box>
    {SECTIONS.map((s, i) => <CapabilitySection key={s.id} section={s} index={i} />)}
    <CTABand />
  </>;
}

export default function FeaturesPage() { return <SiteShell><FeaturesContent /></SiteShell>; }
