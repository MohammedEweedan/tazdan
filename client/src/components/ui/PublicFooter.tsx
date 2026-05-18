"use client";

import NextLink from "next/link";
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
import { FiTwitter, FiGithub, FiLinkedin, FiInstagram } from "react-icons/fi";
import { useTranslate } from "@tolgee/react";
import Logo from "@/components/ui/Logo";

export default function PublicFooter() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub = dark ? "rgba(255,255,255,0.55)" : "#64748b";
  const border = dark ? "rgba(255,255,255,0.06)" : "rgba(0,87,184,0.08)";

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
      ],
    },
    {
      title: t("footer_support"),
      links: [
        { label: t("nav_help"), href: "/help" },
        { label: "FAQ", href: "/faq" },
        { label: t("nav_contact"), href: "/contact" },
        { label: t("footer_terms"), href: "/terms" },
        { label: t("footer_privacy"), href: "/privacy" },
        { label: t("footer_compliance"), href: "/compliance" },
      ],
    },
  ];

  const socials: { icon: typeof FiTwitter; href: string; label: string }[] = [
    { icon: FiTwitter, href: "https://twitter.com", label: "Twitter" },
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
        {/* Top row: brand + nav columns */}
        <SimpleGrid
          columns={{ base: 2, sm: 3, md: 5 }}
          spacingX={{ base: 6, md: 10 }}
          spacingY={{ base: 8, md: 6 }}
          mb={{ base: 8, md: 10 }}
        >
          <VStack
            align="start"
            spacing={3}
            gridColumn={{ base: "1 / -1", md: "span 2" }}
          >
            <Logo h={32} />
            <Text fontSize="13px" color={textSub} lineHeight="1.6" maxW="280px">
              {t("footer_tagline")}
            </Text>
          </VStack>
          {cols.map((col) => (
            <VStack key={col.title} align="start" spacing={2.5}>
              <Text
                fontSize="10px"
                fontWeight="700"
                color={textMain}
                letterSpacing="0.14em"
                textTransform="uppercase"
                opacity={0.85}
              >
                {col.title}
              </Text>
              {col.links.map((l) => (
                <Box
                  key={l.href + l.label}
                  as={l.href.startsWith("/#") ? "a" : NextLink}
                  href={l.href}
                  fontSize="13px"
                  color={textSub}
                  _hover={{ color: textMain }}
                  transition="color 0.15s"
                  cursor="pointer"
                >
                  {l.label}
                </Box>
              ))}
            </VStack>
          ))}
        </SimpleGrid>

        {/* Bottom row: copy + socials */}
        <Flex
          pt={{ base: 5, md: 6 }}
          borderTop="1px solid"
          borderColor={border}
          direction={{ base: "column-reverse", md: "row" }}
          align={{ base: "center", md: "center" }}
          justify="space-between"
          gap={{ base: 4, md: 0 }}
        >
          <Text fontSize="12px" color={textSub} textAlign={{ base: "center", md: "start" }}>
            {t("footer_copy")}
          </Text>
          <HStack spacing={1}>
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
                w="34px"
                h="34px"
                borderRadius="full"
                color={textSub}
                _hover={{ color: textMain, bg: dark ? "rgba(255,255,255,0.04)" : "rgba(0,87,184,0.06)" }}
                transition="all 0.15s"
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
