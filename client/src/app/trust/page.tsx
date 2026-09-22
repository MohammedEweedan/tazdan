"use client";

import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, useColorMode,
} from "@chakra-ui/react";
import {
  FiShield, FiLock, FiAlertTriangle, FiCheckCircle,
  FiKey, FiFileText, FiActivity, FiSliders, FiMinusCircle,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import { Band, BentoCard, CTASection, PageHero, Reveal, SectionHeading } from "@/components/ui/appleKit";

export default function TrustPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const {
    pageBg, textMain, textSub, cardBg, cardBorder,
    accentText, accentSoft, accentBorder,
  } = publicPageTheme(dark);
  const warnBg     = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const warnBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";

  /* Five supporting controls. The sixth card was "Regulatory compliance —
     licensed and registered in applicable jurisdictions", which is not true;
     licensing status now has its own honest section further down. */
  const controls = [
    { icon: FiKey,      title: t("trust_g1_t"), desc: t("trust_g1_d") },
    { icon: FiLock,     title: t("trust_g2_t"), desc: t("trust_g2_d") },
    { icon: FiShield,   title: t("trust_g3_t"), desc: t("trust_g3_d") },
    { icon: FiSliders,  title: t("trust_g4_t"), desc: t("trust_g4_d") },
    { icon: FiFileText, title: t("trust_g5_t"), desc: t("trust_g5_d") },
    { icon: FiCheckCircle, title: t("trust_g6_t"), desc: t("trust_g6_d") },
  ];

  /* Rendered as a definition list rather than another six icon cards — twelve
     interchangeable tiles in a row is what made this page read as filler. */
  const amlPoints = [
    { title: t("trust_aml1_t"), desc: t("trust_aml1_d") },
    { title: t("trust_aml2_t"), desc: t("trust_aml2_d") },
    { title: t("trust_aml3_t"), desc: t("trust_aml3_d") },
    { title: t("trust_aml4_t"), desc: t("trust_aml4_d") },
    { title: t("trust_aml5_t"), desc: t("trust_aml5_d") },
    { title: t("trust_aml6_t"), desc: t("trust_aml6_d") },
  ];

  const status = [
    { title: t("trust_status_1_t"), desc: t("trust_status_1_d") },
    { title: t("trust_status_2_t"), desc: t("trust_status_2_d") },
    { title: t("trust_status_3_t"), desc: t("trust_status_3_d") },
  ];

  const legalPoints = [
    t("trust_legal1"), t("trust_legal2"), t("trust_legal3"),
    t("trust_legal4"), t("trust_legal5"), t("trust_legal6"), t("trust_legal7"),
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <PageHero
        eyebrow={t("trust_eyebrow")}
        title={t("trust_title")}
        subtitle={t("trust_sub")}
      />

      {/* ── The one control worth leading with ─────────────────────────────
          Given its own full-width panel rather than being the first of six
          equal tiles: the conservation audit is the actual differentiator,
          and burying it in a grid made it look like filler. */}
      <Band maxW="1200px">
        <SectionHeading
          title={t("trust_guarantees_title")}
          lede={t("trust_guarantees_sub")}
        />

        <Reveal>
          <Box
            bg={accentSoft}
            border="1px solid" borderColor={accentBorder}
            borderRadius="28px"
            p={{ base: 6, md: 10 }}
            mb={5}
          >
            <HStack spacing={3} mb={4} align="center">
              <Flex
                w="40px" h="40px" borderRadius="11px"
                bg={dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)"}
                border="1px solid" borderColor={accentBorder}
                align="center" justify="center" flexShrink={0}
              >
                <Icon as={FiActivity} color={accentText} boxSize={5} />
              </Flex>
              <Heading
                fontSize={{ base: "20px", md: "27px" }} fontWeight="800"
                color={textMain} letterSpacing="-0.025em" lineHeight="1.15"
              >
                {t("trust_lead_t")}
              </Heading>
            </HStack>
            <Text
              fontSize={{ base: "14.5px", md: "16.5px" }}
              color={textSub} lineHeight="1.75" maxW="74ch"
            >
              {t("trust_lead_d")}
            </Text>
          </Box>
        </Reveal>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} w="100%">
          {controls.map((c, i) => (
            <BentoCard
              key={c.title}
              icon={c.icon}
              title={c.title}
              desc={c.desc}
              delay={i * 0.04}
            />
          ))}
        </SimpleGrid>
      </Band>

      {/* ── AML / KYC — a definition list, not more tiles ──────────────── */}
      <Band tone="alt" maxW="1000px">
        <SectionHeading
          eyebrow={t("trust_aml_tag")}
          title={t("trust_aml_title")}
          lede={t("trust_aml_sub")}
        />
        <Reveal>
          <VStack align="stretch" spacing={0} w="100%">
            {amlPoints.map((p, i) => (
              <SimpleGrid
                key={p.title}
                columns={{ base: 1, md: 12 }} gap={{ base: 2, md: 8 }}
                py={{ base: 5, md: 6 }}
                borderTop={i === 0 ? "none" : "1px solid"}
                borderColor={cardBorder}
              >
                <Box gridColumn={{ md: "span 4" }}>
                  <Text fontSize={{ base: "15px", md: "16px" }} fontWeight="700" color={textMain} letterSpacing="-0.01em">
                    {p.title}
                  </Text>
                </Box>
                <Box gridColumn={{ md: "span 8" }}>
                  <Text fontSize={{ base: "14px", md: "15px" }} color={textSub} lineHeight="1.7">
                    {p.desc}
                  </Text>
                </Box>
              </SimpleGrid>
            ))}
          </VStack>
        </Reveal>
      </Band>

      {/* ── Status ─────────────────────────────────────────────────────────
          The page previously claimed to be licensed, to publish real-time
          proof of reserves and to have third-party audits. None of that is
          true yet. Saying so plainly is worth more than the claim was. */}
      <Band maxW="1000px">
        <SectionHeading
          eyebrow={t("trust_status_tag")}
          title={t("trust_status_title")}
          lede={t("trust_status_sub")}
        />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5} w="100%">
          {status.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <Box
                h="100%"
                bg={cardBg} border="1px dashed" borderColor={warnBorder}
                borderRadius="20px" p={6}
              >
                <HStack spacing={2} mb={3}>
                  <Icon as={FiMinusCircle} color={textSub} boxSize={4} />
                  <Text fontSize="12px" fontWeight="700" color={textSub} textTransform="uppercase" letterSpacing="0.08em">
                    {s.title}
                  </Text>
                </HStack>
                <Text fontSize="14px" color={textMain} lineHeight="1.7" opacity={0.9}>
                  {s.desc}
                </Text>
              </Box>
            </Reveal>
          ))}
        </SimpleGrid>
      </Band>

      {/* ── Legal disclosures (kept — already specific and correct) ─────── */}
      <Container maxW="820px" py={{ base: 10, md: 16 }}>
        <Box bg={warnBg} border="1px solid" borderColor={warnBorder} borderRadius="24px" p={{ base: 6, md: 10 }}>
          <HStack spacing={3} mb={6}>
            <Flex
              w="40px" h="40px" bg={accentSoft} border="1px solid" borderColor={accentBorder}
              borderRadius="10px" align="center" justify="center" flexShrink={0}
            >
              <Icon as={FiAlertTriangle} color={accentText} boxSize={5} />
            </Flex>
            <Heading fontSize={{ base: "20px", md: "24px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em">
              {t("trust_legal_title")}
            </Heading>
          </HStack>
          <VStack align="stretch" spacing={4}>
            {legalPoints.map((p, i) => (
              <HStack key={i} align="flex-start" spacing={3}>
                <Box w="6px" h="6px" borderRadius="2px" bg={textMain} mt="8px" flexShrink={0} opacity={0.5} />
                <Text fontSize={{ base: "13.5px", md: "14.5px" }} color={textSub} lineHeight="1.75">{p}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </Container>

      <CTASection
        title={t("trust_cta_title")}
        subtitle={t("trust_cta_sub")}
        primary={{ label: t("nav_contact"), href: "/contact" }}
        secondary={{ label: t("contact_faq_link"), href: "/faq" }}
      />

      <PublicFooter />
    </Box>
  );
}
