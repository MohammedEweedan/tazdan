"use client";

import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, useColorMode,
} from "@chakra-ui/react";
import {
  FiShield, FiZap, FiLock, FiAlertTriangle, FiCheckCircle,
  FiEye, FiServer, FiFileText, FiUsers,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import { Band, BentoCard, CTASection, PageHero, SectionHeading } from "@/components/ui/appleKit";

export default function TrustPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const {
    pageBg, textMain, textSub, accentText, accentSoft, accentBorder,
  } = publicPageTheme(dark);
  const warnBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const warnBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const iconBg  = accentSoft;

  const guarantees = [
    { icon: FiZap,      title: t("trust_g1_t"), desc: t("trust_g1_d") },
    { icon: FiLock,     title: t("trust_g2_t"), desc: t("trust_g2_d") },
    { icon: FiServer,   title: t("trust_g3_t"), desc: t("trust_g3_d") },
    { icon: FiShield,   title: t("trust_g4_t"), desc: t("trust_g4_d") },
    { icon: FiEye,      title: t("trust_g5_t"), desc: t("trust_g5_d") },
    { icon: FiFileText, title: t("trust_g6_t"), desc: t("trust_g6_d") },
  ];

  const amlPoints = [
    { icon: FiUsers,         title: t("trust_aml1_t"), desc: t("trust_aml1_d") },
    { icon: FiCheckCircle,   title: t("trust_aml2_t"), desc: t("trust_aml2_d") },
    { icon: FiFileText,      title: t("trust_aml3_t"), desc: t("trust_aml3_d") },
    { icon: FiEye,           title: t("trust_aml4_t"), desc: t("trust_aml4_d") },
    { icon: FiShield,        title: t("trust_aml5_t"), desc: t("trust_aml5_d") },
    { icon: FiAlertTriangle, title: t("trust_aml6_t"), desc: t("trust_aml6_d") },
  ];

  const legalPoints = [
    t("trust_legal1"), t("trust_legal2"), t("trust_legal3"),
    t("trust_legal4"), t("trust_legal5"), t("trust_legal6"), t("trust_legal7"),
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <PageHero
        eyebrow={t("trust_eyebrow")}
        title={t("trust_title")}
        subtitle={t("trust_sub")}
      />

      {/* Guarantees grid */}
      <Band maxW="1200px">
        <SectionHeading
          title={t("trust_guarantees_title")}
          lede={t("trust_guarantees_sub")}
        />
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} w="100%">
            {guarantees.map((g, index) => (
              <BentoCard
                key={g.title}
                icon={g.icon}
                title={g.title}
                desc={g.desc}
                delay={index * 0.04}
              />
            ))}
          </SimpleGrid>
      </Band>

      {/* AML */}
      <Band tone="alt" maxW="1100px">
          <SectionHeading
            eyebrow={t("trust_aml_tag")}
            title={t("trust_aml_title")}
            lede={t("trust_aml_sub")}
          />
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} w="100%">
              {amlPoints.map((p, index) => (
                <BentoCard
                  key={p.title}
                  icon={p.icon}
                  title={p.title}
                  desc={p.desc}
                  delay={index * 0.04}
                />
              ))}
            </SimpleGrid>
      </Band>

      {/* Legal disclaimer */}
      <Container maxW="820px" py={{ base: 10, md: 16 }}>
        <Box bg={warnBg} border="1px solid" borderColor={warnBorder} borderRadius="24px" p={{ base: 6, md: 10 }}>
          <HStack spacing={3} mb={6}>
            <Flex
              w="40px" h="40px" bg={iconBg} border="1px solid" borderColor={accentBorder}
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
        primary={{ label: t("minimal_cta_primary"), href: "/register" }}
        secondary={{ label: t("nav_contact"), href: "/contact" }}
      />

      <PublicFooter />
    </Box>
  );
}
