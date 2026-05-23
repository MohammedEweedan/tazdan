"use client";

import NextLink from "next/link";
import NextImage from "next/image";
import {
  Box,
  Flex,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { FiUserX, FiGithub, FiLinkedin, FiInstagram, FiX } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import Logo from "@/components/ui/Logo";

export default function PublicFooter() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";

  const cols: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t("footer_product"),
      links: [
        { label: t("nav_features"), href: "/#features" },
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
        { label: t("nav_help"), href: "/help" },
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
    { icon: FiLinkedin, href: "https://linkedin.com", label: "LinkedIn" },
    { icon: FiGithub, href: "https://github.com", label: "GitHub" },
  ];

  return (
    <Box
      as="footer"
      pt={{ base: 10, md: 14 }}
      pb={{ base: 6, md: 8 }}
      px={{ base: 5, md: 10 }}
      borderColor={border}
    >
      <Box maxW="1280px" mx="auto">
        {/* Top row: brand (full width on mobile) */}
        <VStack align="start" spacing={3} mb={{ base: 7, md: 8 }}>
          <Logo h={32} />
          <Text fontSize="13px" color={textSub} lineHeight="1.6" maxW="320px">
            {t("footer_tagline")}
          </Text>
        </VStack>

        {/* Nav columns — 3 on mobile, 3 on desktop */}
        <SimpleGrid
          columns={{ base: 3, md: 3 }}
          spacingX={{ base: 4, md: 12 }}
          spacingY={{ base: 8, md: 6 }}
          mb={{ base: 8, md: 10 }}
        >
          {cols.map((col) => (
            <VStack key={col.title} align="start" spacing={2}>
              <Text
                fontSize="10px"
                fontWeight="700"
                color={textMain}
                letterSpacing="0.14em"
                textTransform="uppercase"
                opacity={0.85}
                mb={0.5}
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
                >
                  {l.label}
                </Box>
              ))}
            </VStack>
          ))}
        </SimpleGrid>

        {/* Bottom bar — single divider, everything in one row */}
        <Flex
          pt={{ base: 6, md: 7 }}
          borderTop="1px solid"
          borderColor={border}
          direction={{ base: "column", md: "row" }}
          align={{ base: "start", md: "center" }}
          justify="space-between"
          gap={{ base: 5, md: 0 }}
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
              href="mailto:support@fortuni.com"
              fontSize="11px"
              color={dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.38)"}
              _hover={{ color: textSub }}
              transition="color 0.15s"
            >
              support@fortuni.com
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
