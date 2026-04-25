"use client";

import NextLink from "next/link";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  HStack,
  Icon,
  Flex,
  Button,
  useColorMode,
} from "@chakra-ui/react";
import {
  FiEye,
  FiMapPin,
  FiShield,
  FiKey,
  FiArrowRight,
} from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";

export default function AboutPage() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const pageBg = dark ? "#000000" : "#fafbfe";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const cardBg = dark ? "rgba(255,255,255,0.03)" : "white";
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "rgba(0,87,184,0.1)";
  const glow = dark ? "rgba(0,87,184,0.18)" : "rgba(0,87,184,0.08)";

  const titleGradient = dark
    ? "linear(to-b, #4a8fe0 0%, #ffffff 55%, rgba(255,255,255,0.5) 100%)"
    : "linear(to-b, #0057b8 0%, #0a0f1e 55%, rgba(10,15,30,0.4) 100%)";

  const values = [
    { icon: FiEye, title: t("page_about_v1_t"), desc: t("page_about_v1_d") },
    { icon: FiMapPin, title: t("page_about_v2_t"), desc: t("page_about_v2_d") },
    { icon: FiShield, title: t("page_about_v3_t"), desc: t("page_about_v3_d") },
    { icon: FiKey, title: t("page_about_v4_t"), desc: t("page_about_v4_d") },
  ];

  const stats = [
    { v: "120k+", l: t("page_about_stats_users") },
    { v: "$180M", l: t("page_about_stats_volume") },
    { v: "14", l: t("page_about_stats_countries") },
    { v: "99.98%", l: t("page_about_stats_uptime") },
  ];

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* Hero */}
      <Box position="relative" pt={{ base: "110px", md: "160px" }} pb={{ base: 12, md: 20 }}>
        <Box position="absolute" top="20%" left="50%" transform="translateX(-50%)" w={{ base: "600px", md: "900px" }} h="500px" bg={glow} filter="blur(120px)" borderRadius="full" pointerEvents="none" />
        <Container maxW="1100px" position="relative" zIndex={1}>
          <VStack spacing={6} textAlign="center">
            <Heading
              as="h1"
              fontFamily="'DM Sans', sans-serif"
              fontWeight="800"
              fontSize={{ base: "40px", md: "72px" }}
              lineHeight="1.0"
              letterSpacing="-0.04em"
              bgGradient={titleGradient}
              bgClip="text"
              maxW="900px"
            >
              {t("page_about_title")}
            </Heading>
            <Text fontSize={{ base: "15px", md: "18px" }} color={textSub} maxW="640px" lineHeight="1.7">
              {t("page_about_sub")}
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Story */}
      <Container maxW="880px" py={{ base: 10, md: 16 }}>
        <VStack spacing={6} align="start">
          <Heading fontSize={{ base: "28px", md: "40px" }} fontWeight="800" letterSpacing="-0.03em" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("page_about_story_title")}
          </Heading>
          <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.85">
            {t("page_about_story_p1")}
          </Text>
          <Text fontSize={{ base: "15px", md: "17px" }} color={textSub} lineHeight="1.85">
            {t("page_about_story_p2")}
          </Text>
        </VStack>
      </Container>

      {/* Stats strip */}
      <Box py={{ base: 10, md: 14 }} px={{ base: 4, md: 12 }}>
        <Container maxW="1200px">
          <SimpleGrid
            columns={{ base: 2, md: 4 }}
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="28px"
            py={{ base: 8, md: 10 }}
            px={{ base: 6, md: 10 }}
            backdropFilter="blur(16px)"
            boxShadow={dark ? "none" : "0 8px 30px rgba(0,87,184,0.06)"}
          >
            {stats.map((s) => (
              <VStack key={s.l} align={{ base: "start", md: "center" }} spacing={1.5} py={3}>
                <Heading fontSize={{ base: "28px", md: "38px" }} fontWeight="800" letterSpacing="-0.03em" color={textMain} fontFamily="'DM Sans', sans-serif">
                  {s.v}
                </Heading>
                <Text fontSize="12.5px" color={textSub} fontWeight="600">
                  {s.l}
                </Text>
              </VStack>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Values */}
      <Container maxW="1200px" py={{ base: 12, md: 20 }}>
        <VStack spacing={12}>
          <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="800" letterSpacing="-0.03em" textAlign="center" fontFamily="'DM Sans', sans-serif" color={textMain}>
            {t("page_about_values_title")}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={5} w="100%">
            {values.map((v) => (
              <Box
                key={v.title}
                bg={cardBg}
                border="1px solid"
                borderColor={cardBorder}
                borderRadius="24px"
                p={{ base: 6, md: 8 }}
                backdropFilter="blur(12px)"
                transition="all 0.25s ease"
                _hover={{ transform: "translateY(-4px)", boxShadow: dark ? "0 20px 40px rgba(0,87,184,0.15)" : "0 20px 40px rgba(0,87,184,0.08)" }}
              >
                <Flex w="44px" h="44px" bg="rgba(0,87,184,0.15)" border="1px solid rgba(0,87,184,0.3)" borderRadius="12px" align="center" justify="center" mb={5}>
                  <Icon as={v.icon} color="#4a8fe0" boxSize={5} />
                </Flex>
                <Heading fontSize="21px" fontWeight="700" color={textMain} letterSpacing="-0.02em" fontFamily="'DM Sans', sans-serif" mb={2}>
                  {v.title}
                </Heading>
                <Text fontSize="14.5px" color={textSub} lineHeight="1.7">
                  {v.desc}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>

      {/* CTA strip */}
      <Container maxW="1100px" py={{ base: 10, md: 20 }}>
        <Box
          borderRadius="32px"
          overflow="hidden"
          position="relative"
          bg="linear-gradient(135deg, #0057b8 0%, #001a3d 100%)"
          p={{ base: 10, md: 16 }}
          textAlign="center"
          boxShadow="0 40px 80px rgba(0,87,184,0.25)"
        >
          <Box position="absolute" inset={0} opacity={0.08} backgroundImage="radial-gradient(circle at 2px 2px, white 1px, transparent 0)" backgroundSize="36px 36px" pointerEvents="none" />
          <VStack spacing={6} position="relative" zIndex={2}>
            <Heading fontSize={{ base: "28px", md: "44px" }} fontWeight="800" color="white" letterSpacing="-0.03em" lineHeight="1.1" fontFamily="'DM Sans', sans-serif" maxW="560px">
              {t("page_about_cta")}
            </Heading>
            <HStack spacing={3}>
              <Button
                as={NextLink}
                href="/register"
                h="52px"
                px={8}
                bg="white"
                color="#0057b8"
                borderRadius="14px"
                fontWeight="800"
                fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ transform: "scale(1.03)" }}
                transition="all 0.2s"
              >
                {t("nav_register")}
              </Button>
              <Button
                as={NextLink}
                href="/contact"
                h="52px"
                px={8}
                variant="ghost"
                color="white"
                borderRadius="14px"
                fontWeight="700"
                fontSize="14px"
                _hover={{ bg: "rgba(255,255,255,0.1)" }}
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
