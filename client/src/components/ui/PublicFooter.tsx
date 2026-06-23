"use client";

import NextLink from "next/link";
import NextImage from "next/image";
import {
  Box,
  Flex,
  HStack,
  Heading,
  Icon,
  SimpleGrid,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { FiAlertTriangle, FiGithub, FiInstagram, FiX } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import Logo from "@/components/ui/Logo";
import ShaderLines from "@/components/ui/shader-lines";

export default function PublicFooter() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const disclosureBg = dark ? "rgba(255,255,255,0.026)" : "rgba(255,255,255,0.72)";
  const disclosureIconBg = dark ? "rgba(255,255,255,0.045)" : "rgba(10,15,30,0.045)";

  const disclosureItems = [
    t("footer_disclaimer_loss"),
    t("footer_disclaimer_protection"),
    t("footer_disclaimer_advice"),
    t("footer_disclaimer_transfers"),
    t("footer_disclaimer_terms"),
  ];

  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t("footer_product"),
      links: [
        { label: t("nav_features"), href: "/features" },
        { label: t("nav_fees"), href: "/fees" },
        { label: t("footer_cards"), href: "/#cta" },
      ],
    },
    {
      title: t("footer_company"),
      links: [
        { label: t("nav_about"), href: "/about" },
        { label: t("nav_careers"), href: "/careers" },
        { label: t("nav_contact"), href: "/contact" },
        { label: t("nav_trust"), href: "/trust" },
        { label: t("nav_partners"), href: "/partners" },
      ],
    },
    {
      title: t("footer_support"),
      links: [
        { label: t("nav_faq"), href: "/faq" },
        { label: t("nav_contact"), href: "/contact" },
        { label: t("footer_terms"), href: "/terms" },
        { label: t("footer_privacy"), href: "/privacy" },
        { label: t("footer_compliance"), href: "/compliance" },
        { label: t("nav_risk"), href: "/risk" },
      ],
    },
  ];

  const socials: { icon: typeof FiX; href: string; label: string }[] = [
    { icon: FiX, href: "https://twitter.com", label: "Twitter" },
    { icon: FiInstagram, href: "https://instagram.com", label: "Instagram" },
    { icon: FiGithub, href: "https://github.com", label: "GitHub" },
  ];

  return (
    <Box
      as="footer"
      position="relative"
      overflow="hidden"
      w="100%"
      // Full-bleed band: a faint surface + a full-width top hairline so the
      // footer reads as a distinct edge-to-edge section, not a floating box.
      bg={dark ? "#0E1116" : "#F8FAFC"}
      borderTop="1px solid"
      borderColor={border}
      pt={{ base: 10, md: 14 }}
      pb={{ base: 6, md: 8 }}
      px={{ base: 4, md: 8 }}
    >
      <Box aria-hidden position="absolute" inset={0} zIndex={0} pointerEvents="none">
        <Box
          position="absolute"
          inset={0}
          opacity={dark ? 0.075 : 0.055}
          filter="saturate(0.9)"
          sx={{
            maskImage: "linear-gradient(180deg, transparent 0%, #000 18%, #000 76%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 18%, #000 76%, transparent 100%)",
          }}
        >
          <ShaderLines mode={dark ? "dark" : "light"} />
        </Box>
      </Box>

      <Box maxW="1180px" mx="auto" position="relative" zIndex={1}>
        <SimpleGrid
          columns={{ base: 3, md: 4 }}
          gridTemplateColumns={{ base: "repeat(3, minmax(0, 1fr))", md: "1.35fr 0.75fr 0.75fr 0.9fr" }}
          spacingX={{ base: 4, md: 10 }}
          spacingY={{ base: 8, md: 5 }}
          mb={{ base: 8, md: 10 }}
        >
          <VStack align="start" spacing={3.5} maxW="360px" gridColumn={{ base: "1 / -1", md: "auto" }}>
            <Logo h={32} />
            <Heading
              as="h2"
              fontFamily="'DM Sans', sans-serif"
              fontSize={{ base: "24px", md: "28px" }}
              lineHeight="1.05"
              letterSpacing="-0.04em"
              color={textMain}
              fontWeight="850"
            >
              {t("footer_statement")}
            </Heading>
            <Text fontSize={{ base: "13px", md: "13.5px" }} color={textSub} lineHeight="1.7" maxW="350px">
              {t("footer_tagline")}
            </Text>
          </VStack>

          {cols.map((col) => (
            <VStack key={col.title} align="start" spacing={2.25} minW={0}>
              <Text
                fontSize={{ base: "9px", md: "10px" }}
                fontWeight="700"
                color={textMain}
                letterSpacing={{ base: "0.08em", md: "0.14em" }}
                textTransform="uppercase"
                opacity={0.85}
                mb={0.5}
                noOfLines={1}
              >
                {col.title}
              </Text>
              {col.links.map((l) => (
                <Box
                  key={l.href + l.label}
                  as={l.href.startsWith("/#") ? "a" : NextLink}
                  href={l.href}
                  fontSize={{ base: "12px", md: "13px" }}
                  color={textSub}
                  _hover={{ color: textMain }}
                  transition="color 0.15s"
                  cursor="pointer"
                  lineHeight="1.5"
                  wordBreak="break-word"
                >
                  {l.label}
                </Box>
              ))}
            </VStack>
          ))}
        </SimpleGrid>

        <Box
          bg={disclosureBg}
          border="1px solid"
          borderColor={border}
          borderRadius="14px"
          p={{ base: 3.5, md: 4 }}
          mb={{ base: 7, md: 8 }}
          backdropFilter="blur(16px)"
        >
          <HStack spacing={2.5} align="center" mb={3}>
            <Flex
              w="26px"
              h="26px"
              borderRadius="full"
              align="center"
              justify="center"
              bg={disclosureIconBg}
              border="1px solid"
              borderColor={border}
              flexShrink={0}
            >
              <Icon as={FiAlertTriangle} boxSize={3} color={textMain} />
            </Flex>
            <Text fontSize={{ base: "11.5px", md: "12.5px" }} fontWeight="800" color={textMain}>
              {t("footer_disclaimer_title")}
            </Text>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 2, md: 3 }}>
            {disclosureItems.map((item) => (
              <HStack key={item} align="flex-start" spacing={2}>
                <Box
                  w="4px"
                  h="4px"
                  borderRadius="full"
                  bg={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.42)"}
                  mt="7px"
                  flexShrink={0}
                />
                <Text fontSize={{ base: "9.5px", md: "10.5px" }} lineHeight="1.55" color={textSub}>
                  {item}
                </Text>
              </HStack>
            ))}
          </SimpleGrid>

          <Box
            as={NextLink}
            href="/risk"
            display="inline-flex"
          mt={3.5}
          fontSize="10.5px"
            fontWeight="800"
            color={dark ? "#8BBCE8" : "#3E78AE"}
            _hover={{ color: textMain }}
            transition="color 0.15s"
          >
            {t("footer_disclaimer_risk_link")}
          </Box>
        </Box>

        {/* Bottom bar — single divider, everything in one row */}
        <Flex
          pt={{ base: 5, md: 6 }}
          borderTop="1px solid"
          borderColor={border}
          direction={{ base: "column", md: "row" }}
          align={{ base: "start", md: "center" }}
          justify="space-between"
          gap={{ base: 4, md: 0 }}
          wrap="wrap"
        >
          {/* Left cluster: copyright + address + email */}
          <VStack align="start" spacing={1.5}>
            <Text fontSize="12px" color={textSub}>
              {t("footer_copy")}
            </Text>
            <Text fontSize="11px" color={dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)"}>
              128 City Road, London, United Kingdom, EC1V 2NX
            </Text>
            <Box
              as="a"
              href="mailto:support@tazdan.com"
              fontSize="11px"
              color={dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)"}
              _hover={{ color: textSub }}
              transition="color 0.15s"
            >
              support@tazdan.com
            </Box>
          </VStack>

          {/* Right cluster: trust badges + socials */}
          <HStack spacing={4} align="center" flexWrap="wrap">
            {/* SOC 2 cert */}
            <Box
              w="36px" h="36px"
              position="relative"
              flexShrink={0}
              opacity={dark ? 0.7 : 0.55}
              _hover={{ opacity: 1 }}
              transition="opacity 0.15s"
            >
              <NextImage src="/SOCcert.avif" alt="SOC 2 Certified" fill style={{ objectFit: "contain" }} />
            </Box>
            {/* PCI-DSS badge */}
            <Box
              w="52px" h="32px"
              position="relative"
              flexShrink={0}
              opacity={dark ? 0.7 : 0.55}
              _hover={{ opacity: 1 }}
              transition="opacity 0.15s"
            >
              <NextImage src="/pci-dss.png" alt="PCI-DSS Compliant" fill style={{ objectFit: "contain" }} />
            </Box>
            {/* AES-256 badge */}
            <Box
              w="52px" h="32px"
              position="relative"
              flexShrink={0}
              opacity={dark ? 0.7 : 0.55}
              _hover={{ opacity: 1 }}
              transition="opacity 0.15s"
            >
              <NextImage src="/aes-256.webp" alt="AES-256 Encrypted" fill style={{ objectFit: "contain" }} />
            </Box>
            {/* Divider */}
            <Box w="1px" h="20px" bg={border} flexShrink={0} />
            {/* Social icons */}
            {socials.map((s) => (
              <Box
                key={s.label}
                as="a"
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                w="30px"
                h="30px"
                borderRadius="full"
                color={dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)"}
                _hover={{ color: textMain }}
                transition="color 0.15s"
              >
                <Icon as={s.icon} boxSize={3.5} />
              </Box>
            ))}
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
