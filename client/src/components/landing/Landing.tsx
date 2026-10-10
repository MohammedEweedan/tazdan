"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Landing page. Editorial and quiet on purpose: a centred hero whose visual
   is the Taz demo, then numbered sections separated by whitespace and hairline
   rules rather than tinted bands. Section order follows how a visitor decides:
   what it is (hero + demo) → is it real (stats) → what it does (platform) →
   business → is it safe → what it costs → questions → join.

   Every string is i18n; `lp_*` keys are this page's own, and it reuses the
   approved infra / business / fees / FAQ copy where that already exists.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { Box, Collapse, useDisclosure } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  FiBookOpen, FiCheck, FiKey, FiPlus, FiShield, FiSmartphone, FiUserCheck, FiUsers,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import WaitlistModal from "@/components/ui/WaitlistModal";
import { Reveal, useAppleLocale } from "@/components/ui/appleKit";
import Mascot from "./Mascot";
import MascotDemo from "./MascotDemo";
import {
  Container, Frame, Headline, MONO, Module, Mono, Para, Pill, SECTION_GAP, SectionHead, Tag, useLandingTheme, useSides,
} from "./kit";

const MBox = motion.create(Box as any) as any;

const GRID_3 = { base: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" };

/* ── announcement bar ─────────────────────────────────────────────────────── */

export function AnnouncementBar({ onJoin }: { onJoin: () => void }) {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  // PublicNav looks this id up and parks itself below the bar until the bar
  // scrolls away.
  return (
    <Box id="risk-banner" bg={t.fg} color={t.bg} position="relative" zIndex={201}>
      <Box
        as="button"
        type="button"
        onClick={onJoin}
        w="100%"
        h="38px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        gap="8px"
        fontSize="13.5px"
        fontWeight={500}
        _hover={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
      >
        <Box as="span" display={{ base: "none", sm: "inline" }}>{tr("lp_banner")}</Box>
        <Box as="span" display={{ base: "inline", sm: "none" }}>{tr("lp_banner_short")}</Box>
        <Box as="span" opacity={0.5} aria-hidden>·</Box>
        <span>{tr("lp_banner_cta")}</span>
      </Box>
    </Box>
  );
}

/* ── hero ─────────────────────────────────────────────────────────────────── */

function Hero({ onJoin }: { onJoin: () => void }) {
  const { t: tr } = useTranslate();
  const [tourKey, setTourKey] = useState(0);
  const takeTour = () => {
    setTourKey((k) => k + 1);
    document.getElementById("tour")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <Container
        pt="clamp(116px, 15vw, 176px)"
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
      >
        <Headline as="h1" size="hero" text={tr("lp_hero_title")} maxW="16ch" textAlign="center" />
        <Para align="center" maxW="600px" mt="clamp(18px, 2.2vw, 26px)" fontSize={{ base: "17px", md: "19px" }}>
          {tr("lp_hero_lead")}
        </Para>
        <Box display="flex" gap="10px" flexWrap="wrap" justifyContent="center" mt="clamp(24px, 3vw, 36px)">
          <Pill size="lg" onClick={onJoin} arrow>{tr("lp_hero_cta_primary")}</Pill>
          <Pill size="lg" variant="outline" onClick={takeTour}>{tr("lp_hero_cta_tour")}</Pill>
        </Box>
        <Mono mt="18px" textAlign="center">{tr("lp_hero_note")}</Mono>
      </Container>

      <Container id="tour" mt="clamp(40px, 5vw, 72px)" sx={{ scrollMarginTop: "88px" }}>
        <MascotDemo onJoin={onJoin} restartKey={tourKey} />
      </Container>
    </>
  );
}

/* ── stats ────────────────────────────────────────────────────────────────── */

export function Stats() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <SectionHead title={tr("lp_stats_title")} align="end">
        <Para>{tr("lb_infra_sub")}</Para>
      </SectionHead>
      <Box
        mt="clamp(40px, 5vw, 64px)"
        display="grid"
        gridTemplateColumns={{ base: "repeat(2, minmax(0,1fr))", md: "repeat(4, minmax(0,1fr))" }}
        columnGap="clamp(16px, 3vw, 40px)"
        rowGap="28px"
      >
        {[1, 2, 3, 4].map((i) => (
          <Reveal key={i} y={16} delay={i * 0.05}>
            <Box borderTop="1px solid" borderColor={t.line} pt="16px">
              <Box fontSize="14px" color={t.sub}>{tr(`lb_infra_${i}_l`)}</Box>
              <Box
                mt="6px"
                // Word-valued stats ("Double-entry") step down so they sit
                // on one line beside the figures.
                fontSize={/\d/.test(tr(`lb_infra_${i}_n`)) ? "clamp(30px, 4vw, 52px)" : "clamp(24px, 2.8vw, 38px)"}
                fontWeight={500}
                letterSpacing="-0.035em"
                lineHeight={1.05}
                color={t.fg}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {tr(`lb_infra_${i}_n`)}
              </Box>
            </Box>
          </Reveal>
        ))}
      </Box>
      <Mono mt="24px">{tr("lb_infra_note")}</Mono>
    </Container>
  );
}

/* ── platform ─────────────────────────────────────────────────────────────── */

export function Platform() {
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <SectionHead title={tr("lp_platform_title")}>
        <Para>{tr("lp_platform_body")}</Para>
      </SectionHead>
      <Box mt="clamp(40px, 5vw, 72px)" display="grid" gridTemplateColumns={GRID_3} columnGap="clamp(24px, 3vw, 48px)">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Reveal key={i} y={16} delay={((i - 1) % 3) * 0.06}>
            <Module
              index={i}
              title={tr(`lp_platform_${i}_t`)}
              body={tr(`lp_platform_${i}_d`)}
              tag={i === 6 ? tr("lp_biz_soon") : undefined}
            />
          </Reveal>
        ))}
      </Box>
    </Container>
  );
}

/* ── business ─────────────────────────────────────────────────────────────── */

export function Business() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <Box
        display="grid"
        gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1fr)" }}
        gap="clamp(20px, 4vw, 64px)"
        alignItems="start"
      >
        <Box display="flex" flexDirection="column" gap="16px">
          <Box
            display="flex" alignItems="center" gap="10px"
            fontFamily={MONO} fontSize="12.5px" letterSpacing="0.08em" textTransform="uppercase" color={t.fg}
          >
            {tr("lp_biz_eyebrow")} <Tag>{tr("lp_biz_soon")}</Tag>
          </Box>
          <Headline text={tr("lp_biz_title")} size="sub" maxW="16ch" />
        </Box>
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap="18px" maxW="52ch">
          <Para>{tr("lb_biz_sub")}</Para>
          <Pill variant="outline" href="/partners" arrow>{tr("lp_biz_cta")}</Pill>
          <Mono lineHeight={1.5}>{tr("lb_biz_note")}</Mono>
        </Box>
      </Box>
      <Box mt="clamp(48px, 7vw, 104px)" display="grid" gridTemplateColumns={GRID_3} columnGap="clamp(24px, 3vw, 48px)">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Reveal key={i} y={16} delay={((i - 1) % 3) * 0.06}>
            <Module index={i} title={tr(`lb_biz_${i}_t`)} body={tr(`lb_biz_${i}_d`)} />
          </Reveal>
        ))}
      </Box>
    </Container>
  );
}

/* ── security ─────────────────────────────────────────────────────────────── */

const SECURITY_ICONS = [FiBookOpen, FiKey, FiUsers, FiShield, FiUserCheck, FiSmartphone];

export function Security() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <SectionHead title={tr("lp_sec_title")}>
        <Para>{tr("tz_bento_secure_desc")}</Para>
      </SectionHead>
      <Box mt="clamp(40px, 5vw, 64px)" display="grid" gridTemplateColumns={GRID_3} gap="10px">
        {SECURITY_ICONS.map((Icon, idx) => {
          const i = idx + 1;
          return (
            <Reveal key={i} y={16} delay={(idx % 3) * 0.05}>
              <Box
                h="100%"
                border="1px solid"
                borderColor={t.line}
                borderRadius="12px"
                p="18px 18px 20px"
                display="flex"
                flexDirection="column"
                gap="10px"
                transition="border-color .16s ease"
                _hover={{ borderColor: t.lineStrong }}
              >
                <Box
                  w="36px" h="36px" borderRadius="10px" border="1px solid" borderColor={t.line}
                  display="grid" placeItems="center" fontSize="17px" color={t.fg}
                >
                  <Icon />
                </Box>
                <Box as="h3" fontSize="16.5px" fontWeight={500} color={t.fg}>{tr(`lp_sec_${i}_t`)}</Box>
                <Para fontSize="15px" lineHeight={1.55}>{tr(`lp_sec_${i}_d`)}</Para>
              </Box>
            </Reveal>
          );
        })}
      </Box>
      <Mono mt="20px">{tr("lp_sec_note")}</Mono>
    </Container>
  );
}

/* ── pricing ──────────────────────────────────────────────────────────────── */

export function Pricing() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <SectionHead title={tr("lp_price_title")}>
        <Para>{tr("page_fees_sub")}</Para>
      </SectionHead>
      <Box
        mt="clamp(40px, 5vw, 64px)"
        display="grid"
        gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,5fr) minmax(0,7fr)" }}
        gap="clamp(20px, 3vw, 40px)"
        alignItems="stretch"
      >
        <Frame p={{ base: "24px", md: "36px" }} display="flex" flexDirection="column">
          <Box fontSize="clamp(56px, 7vw, 96px)" fontWeight={500} letterSpacing="-0.045em" lineHeight={1} color={t.fg}>
            {tr("lp_price_big")}
          </Box>
          <Box mt="8px" fontSize="16px" color={t.sub}>{tr("lp_price_big_sub")}</Box>
          <Box as="ul" mt="28px" listStyleType="none" display="flex" flexDirection="column" gap="12px">
            {[1, 2, 3].map((i) => (
              <Box as="li" key={i} display="flex" gap="10px" fontSize="15.5px" lineHeight={1.5} color={t.fg}>
                <Box as="span" mt="4px" flexShrink={0} color={t.green}><FiCheck /></Box>
                {tr(`lp_price_b${i}`)}
              </Box>
            ))}
          </Box>
          <Box mt="auto" pt="28px">
            <Pill variant="outline" href="/fees" arrow>{tr("lp_price_link")}</Pill>
          </Box>
        </Frame>

        <Box borderTop="1px solid" borderColor={t.lineStrong}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              py="22px"
              borderBottom="1px solid"
              borderColor={t.line}
              display="grid"
              gridTemplateColumns="minmax(0,1fr) auto"
              columnGap="20px"
              alignItems="baseline"
            >
              <Box>
                <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
                  <Box as="h3" fontSize="18px" fontWeight={500} color={t.fg}>{tr(`page_fees_row${i}_s`)}</Box>
                  <Tag>{tr("lp_price_proposed")}</Tag>
                </Box>
                <Para mt="4px" fontSize="15px" lineHeight={1.55}>{tr(`page_fees_row${i}_n`)}</Para>
              </Box>
              <Box fontSize="clamp(19px, 2.2vw, 26px)" fontWeight={500} letterSpacing="-0.02em" whiteSpace="nowrap" color={t.fg}>
                {tr(`page_fees_row${i}_f`)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [1, 2, 3, 4, 5, 6, 7, 10];

function FaqItem({ n }: { n: number }) {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const { isOpen, onToggle } = useDisclosure();
  const id = `faq-${n}`;
  return (
    <Box borderBottom="1px solid" borderColor={t.line}>
      <Box
        as="button"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={id}
        w="100%"
        py="20px"
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap="16px"
        textAlign="start"
        _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
      >
        <Box as="h3" fontSize={{ base: "16px", md: "17px" }} fontWeight={500} color={t.fg} lineHeight={1.45}>
          {tr(`faq_s_q${n}`)}
        </Box>
        <Box
          as="span" flexShrink={0} mt="3px" fontSize="18px" color={t.sub}
          transform={isOpen ? "rotate(45deg)" : "none"} transition="transform .2s ease"
        >
          <FiPlus />
        </Box>
      </Box>
      <Collapse in={isOpen} animateOpacity>
        <Para id={id} pb="22px" paddingInlineEnd={{ md: "40px" }} fontSize="15.5px">{tr(`faq_s_a${n}`)}</Para>
      </Collapse>
    </Box>
  );
}

export function Faq() {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  return (
    <Container pt={SECTION_GAP}>
      <Box
        display="grid"
        gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,5fr) minmax(0,7fr)" }}
        gap="clamp(24px, 4vw, 64px)"
        alignItems="start"
      >
        <Box display="flex" flexDirection="column" alignItems="flex-start" gap="18px">
          <Headline text={tr("lp_faq_title")} />
          <Pill variant="text" href="/faq" arrow>{tr("lp_faq_more")}</Pill>
        </Box>
        <Box borderTop="1px solid" borderColor={t.lineStrong}>
          {FAQ_ITEMS.map((n) => <FaqItem key={n} n={n} />)}
        </Box>
      </Box>
    </Container>
  );
}

/* ── closing CTA: Taz peeks up out of the frame and waves ─────────────────── */

export function ClosingCta({ onJoin }: { onJoin: () => void }) {
  const t = useLandingTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useAppleLocale();
  const side = useSides();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return (
    <Container pt={SECTION_GAP} pb="clamp(64px, 8vw, 120px)">
      <Frame
        ref={ref}
        minH={{ base: "500px", md: "480px" }}
        display="flex"
        flexDirection="column"
        alignItems="center"
        textAlign="center"
        px={{ base: "20px", md: "48px" }}
        pt={{ base: "48px", md: "80px" }}
        pb={{ base: "170px", md: "80px" }}
      >
        <Headline text={tr("lp_cta_title")} textAlign="center" maxW="14ch" />
        <Para align="center" maxW="46ch" mt="18px">{tr("lp_cta_body")}</Para>
        <Box display="flex" gap="10px" flexWrap="wrap" justifyContent="center" mt="28px">
          <Pill size="lg" onClick={onJoin} arrow>{tr("lp_hero_cta_primary")}</Pill>
          <Pill size="lg" variant="outline" href="/partners">{tr("hero_cta_secondary")}</Pill>
        </Box>

        <MBox
          position="absolute"
          bottom={{ base: "-24px", md: "-30px" }}
          {...{ [side.end]: { base: "16px", md: "clamp(24px, 5vw, 72px)" } }}
          w={{ base: "112px", md: "170px" }}
          initial={reduced ? false : { y: "115%" }}
          animate={{ y: inView ? "0%" : "115%" }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
        >
          {/* Taz stands at the end edge, so it faces back toward the copy. */}
          <Mascot pose={inView ? "wave" : "rest"} mirrored={!isAr} label={tr("lp_demo_name")} />
        </MBox>

        <MBox
          position="absolute"
          bottom={{ base: "44px", md: "168px" }}
          {...{ [side.end]: { base: "140px", md: "clamp(24px, 5vw, 72px)" } }}
          maxW={{ base: "170px", md: "200px" }}
          initial={reduced ? false : { opacity: 0, scale: 0.85 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.7 }}
          bg={t.card}
          border="1px solid"
          borderColor={t.line}
          borderRadius="14px"
          px="12px"
          py="9px"
          fontSize="14px"
          fontWeight={500}
          color={t.fg}
          textAlign="start"
          boxShadow={t.dark ? "0 14px 36px rgba(0,0,0,0.3)" : "0 14px 36px rgba(10,10,11,0.07)"}
        >
          {tr("lp_cta_taz")}
          <Box
            position="absolute" w="12px" h="12px" bg={t.card} borderColor={t.line} borderStyle="solid"
            top={{ base: "50%", md: "auto" }}
            mt={{ base: "-6px", md: 0 }}
            bottom={{ base: "auto", md: "-7px" }}
            {...{ [side.end]: { base: "-7px", md: "60px" } }}
            transform={`rotate(${isAr ? -45 : 45}deg)`}
            sx={{
              borderWidth: 0,
              [`border${side.End}Width`]: "1px",
              borderTopWidth: { base: "1px", md: 0 },
              borderBottomWidth: { base: 0, md: "1px" },
            }}
          />
        </MBox>
      </Frame>
    </Container>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function Landing() {
  const t = useLandingTheme();
  const waitlist = useDisclosure();

  // globals.css paints html/body near-black; match the page so overscroll and
  // any gap below the footer never flash the wrong colour.
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = t.bg;
    return () => { document.body.style.background = prev; };
  }, [t.bg]);

  return (
    <Box minH="100vh" bg={t.bg} color={t.fg} overflowX="clip">
      <AnnouncementBar onJoin={waitlist.onOpen} />
      <PublicNav />

      <Box as="main">
        <Hero onJoin={waitlist.onOpen} />
        <Stats />
        <Platform />
        <Business />
        <Security />
        <Pricing />
        <Faq />
        <ClosingCta onJoin={waitlist.onOpen} />
      </Box>

      <WaitlistModal isOpen={waitlist.isOpen} onClose={waitlist.onClose} />
      <PublicFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            name: "tazdan",
            description: "Proposed LYD wallet, supported crypto services and international remittances for Libya.",
            url: "https://tazdan.com",
            areaServed: ["LY"],
            currenciesAccepted: "LYD",
            serviceType: ["Planned LYD wallet", "Planned crypto services", "Planned international remittances"],
            sameAs: ["https://twitter.com/tazdan", "https://t.me/tazdan"],
          }),
        }}
      />
    </Box>
  );
}
