"use client";

import NextLink from "next/link";
import { useTranslate } from "@tolgee/react";
import {
  Box, Container, Heading, Text, VStack, HStack,
  SimpleGrid, Icon, Flex, Button, useColorMode,
} from "@chakra-ui/react";
import {
  FiShield, FiZap, FiLock, FiAlertTriangle, FiCheckCircle,
  FiArrowRight, FiEye, FiServer, FiFileText, FiUsers,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export default function TrustPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg    = dark ? "#000000" : "#ffffff";
  const textMain  = dark ? "#ffffff" : "#0a0f1e";
  const textSub   = dark ? "rgba(255,255,255,0.6)" : "#64748b";
  const cardBg    = dark ? "rgba(255,255,255,0.04)" : "#f4f4f4";
  const cardBorder = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const warnBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const warnBorder = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const ctaBg     = dark ? "#ffffff" : "#0a0f1e";
  const ctaFg     = dark ? "#000000" : "#ffffff";

  const titleGradient = dark
    ? "linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)"
    : "linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)";

  const iconBg  = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

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
      <Box pt={{ base: "120px", md: "160px" }} pb={{ base: 12, md: 20 }} textAlign="center">
        <Container maxW="900px">
          <VStack spacing={6}>
            <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" color={textSub} textTransform="uppercase">
              {t("trust_eyebrow")}
            </Text>
            <Heading
              as="h1" fontWeight="900"
              fontSize={{ base: "48px", md: "80px" }}
              lineHeight="1.0" letterSpacing="-0.04em"
              bgGradient={titleGradient} bgClip="text"
              whiteSpace="pre-line"
            >
              {t("trust_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="600px" lineHeight="1.7">
              {t("trust_sub")}
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Guarantees grid */}
      <Container maxW="1200px" py={{ base: 12, md: 20 }}>
        <VStack spacing={12}>
          <VStack spacing={4} textAlign="center">
            <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="900" letterSpacing="-0.04em" color={textMain}>
              {t("trust_guarantees_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} maxW="500px">
              {t("trust_guarantees_sub")}
            </Text>
          </VStack>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} w="100%">
            {guarantees.map((g) => (
              <Box
                key={g.title}
                bg={cardBg} border="1px solid" borderColor={cardBorder}
                borderRadius="24px" p={{ base: 6, md: 8 }}
                transition="all 0.25s ease"
                _hover={{ transform: "translateY(-4px)", borderColor: dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}
              >
                <Flex w="44px" h="44px" bg={iconBg} border="1px solid" borderColor={cardBorder} borderRadius="12px" align="center" justify="center" mb={5}>
                  <Icon as={g.icon} color={textMain} boxSize={5} />
                </Flex>
                <Heading fontSize="18px" fontWeight="700" color={textMain} letterSpacing="-0.02em" mb={2}>{g.title}</Heading>
                <Text fontSize="14px" color={textSub} lineHeight="1.7">{g.desc}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>

      {/* AML */}
      <Box py={{ base: 12, md: 20 }} px={{ base: 4, md: 8 }}>
        <Container maxW="1100px">
          <VStack spacing={10}>
            <VStack spacing={4} textAlign="center">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" color={textSub} textTransform="uppercase">
                {t("trust_aml_tag")}
              </Text>
              <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="900" letterSpacing="-0.04em" color={textMain} whiteSpace="pre-line">
                {t("trust_aml_title")}
              </Heading>
              <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} maxW="560px">{t("trust_aml_sub")}</Text>
            </VStack>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={5} w="100%">
              {amlPoints.map((p) => (
                <Box key={p.title} bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="20px" p={6}>
                  <Flex w="40px" h="40px" bg={iconBg} border="1px solid" borderColor={cardBorder} borderRadius="10px" align="center" justify="center" mb={4}>
                    <Icon as={p.icon} color={textMain} boxSize={5} />
                  </Flex>
                  <Heading fontSize="16px" fontWeight="700" color={textMain} mb={2}>{p.title}</Heading>
                  <Text fontSize="13.5px" color={textSub} lineHeight="1.7">{p.desc}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Legal disclaimer */}
      <Container maxW="820px" py={{ base: 10, md: 16 }}>
        <Box bg={warnBg} border="1px solid" borderColor={warnBorder} borderRadius="24px" p={{ base: 6, md: 10 }}>
          <HStack spacing={3} mb={6}>
            <Flex
              w="40px" h="40px" bg={iconBg} border="1px solid" borderColor={cardBorder}
              borderRadius="10px" align="center" justify="center" flexShrink={0}
            >
              <Icon as={FiAlertTriangle} color={textMain} boxSize={5} />
            </Flex>
            <Heading fontSize={{ base: "20px", md: "24px" }} fontWeight="800" color={textMain} letterSpacing="-0.02em">
              {t("trust_legal_title")}
            </Heading>
          </HStack>
          <VStack align="stretch" spacing={4}>
            {legalPoints.map((p, i) => (
              <HStack key={i} align="flex-start" spacing={3}>
                <Box w="6px" h="6px" borderRadius="full" bg={textMain} mt="8px" flexShrink={0} opacity={0.5} />
                <Text fontSize={{ base: "13.5px", md: "14.5px" }} color={textSub} lineHeight="1.75">{p}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </Container>

      {/* CTA */}
      <Container maxW="1100px" py={{ base: 10, md: 20 }}>
        <Box
          borderRadius="32px" overflow="hidden" position="relative"
          bg={dark ? "#ffffff" : "#0a0f1e"}
          p={{ base: 10, md: 16 }} textAlign="center"
        >
          <Box
            position="absolute" inset={0} opacity={dark ? 0.04 : 0.06}
            backgroundImage="radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)"
            backgroundSize="36px 36px" pointerEvents="none"
            color={dark ? "black" : "white"}
          />
          <VStack spacing={6} position="relative" zIndex={2}>
            <Heading
              fontSize={{ base: "28px", md: "44px" }} fontWeight="900"
              color={dark ? "#000000" : "#ffffff"} letterSpacing="-0.04em"
              lineHeight="1.1" maxW="560px"
            >
              {t("trust_cta_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "17px" }} color={dark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.75)"} maxW="440px">
              {t("trust_cta_sub")}
            </Text>
            <HStack spacing={3}>
              <Button
                as={NextLink} href="/register"
                h="52px" px={8}
                bg={dark ? "#0a0f1e" : "#ffffff"}
                color={dark ? "#ffffff" : "#0a0f1e"}
                borderRadius="14px" fontWeight="800" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ opacity: 0.9, transform: "scale(1.02)" }} transition="all 0.2s"
              >
                {t("nav_register")}
              </Button>
              <Button
                as={NextLink} href="/contact"
                h="52px" px={8} variant="ghost"
                color={dark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)"}
                borderRadius="14px" fontWeight="700" fontSize="14px"
                _hover={{ bg: dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)" }}
              >
                {t("nav_contact")}
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Container>

      <PublicFooter />
    </Box>
  );
}
