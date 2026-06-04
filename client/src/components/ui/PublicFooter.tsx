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
import { FiAlertTriangle, FiGithub, FiInstagram, FiX } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import Logo from "@/components/ui/Logo";

export default function PublicFooter() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const disclosureBg = dark ? "#1E2127" : "#FFFFFF";
  const disclosureIconBg = dark ? "#262A31" : "#F1F5F9";

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
        { label: t("nav_features"), href: "/#features" },
        { label: t("nav_fees"), href: "/fees" },
        { label: t("footer_cards"), href: "/#cta" },
        { label: t("nav_business"), href: "/business" },
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
      bg={dark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.015)"}
      borderTop="1px solid"
      borderColor={border}
      pt={{ base: 10, md: 14 }}
      pb={{ base: 6, md: 8 }}
      px={{ base: 5, md: 10 }}
    >
      {/* Soft brand-blue glow behind the footer — the same static, directional
          radial aura used behind the mobile balance card. A bright-ish core
          offset to one side + a faint wash, both fading to nothing. */}
      <Box aria-hidden position="absolute" inset={0} zIndex={0} pointerEvents="none">
        {/* Full-bleed glow layer — spans the entire footer (inset 0) so there's
            no gap at either edge in LTR or RTL. The radial origin is offset
            left so the aura feels directional like the mobile balance card. */}
        <Box
          position="absolute" inset={0}
          background={dark
            ? "radial-gradient(ellipse 70% 130% at 30% 25%, rgba(99,161,219,0.18) 0%, rgba(99,161,219,0.05) 42%, transparent 70%)"
            : "radial-gradient(ellipse 70% 130% at 30% 25%, rgba(99,161,219,0.13) 0%, rgba(99,161,219,0.04) 42%, transparent 70%)"}
        />
        {/* Faint secondary wash low-right for depth. */}
        <Box
          position="absolute" inset={0}
          background="radial-gradient(circle 45% at 85% 80%, rgba(99,161,219,0.09) 0%, transparent 60%)"
        />
      </Box>

      <Box maxW="1280px" mx="auto" position="relative" zIndex={1}>
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

        <Box
          bg={disclosureBg}
          border="1px solid"
          borderColor={border}
          borderRadius="20px"
          p={{ base: 5, md: 6 }}
          mb={{ base: 8, md: 10 }}
        >
          <HStack spacing={3} align="center" mb={4}>
            <Flex
              w="34px"
              h="34px"
              borderRadius="full"
              align="center"
              justify="center"
              bg={disclosureIconBg}
              border="1px solid"
              borderColor={border}
              flexShrink={0}
            >
              <Icon as={FiAlertTriangle} boxSize={4} color={textMain} />
            </Flex>
            <Text fontSize={{ base: "13px", md: "14px" }} fontWeight="800" color={textMain}>
              {t("footer_disclaimer_title")}
            </Text>
          </HStack>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 3, md: 4 }}>
            {disclosureItems.map((item) => (
              <HStack key={item} align="flex-start" spacing={2.5}>
                <Box
                  w="5px"
                  h="5px"
                  borderRadius="full"
                  bg={dark ? "rgba(255,255,255,0.45)" : "rgba(10,15,30,0.42)"}
                  mt="8px"
                  flexShrink={0}
                />
                <Text fontSize={{ base: "11px", md: "12px" }} lineHeight="1.65" color={textSub}>
                  {item}
                </Text>
              </HStack>
            ))}
          </SimpleGrid>

          <Box
            as={NextLink}
            href="/risk"
            display="inline-flex"
            mt={4}
            fontSize="12px"
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
