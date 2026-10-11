"use client";

/* Top navigation — a calm bar that picks up a blurred surface and a hairline
   once the page scrolls; on phones the links move into a full-height sheet of
   rows (the app's Panel + PanelRow look). */

import { useEffect, useState } from "react";
import NextLink from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Box, Drawer, DrawerContent, DrawerOverlay, useDisclosure } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiMenu, FiX } from "react-icons/fi";
import { TextLogo } from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
const WaitlistModal = dynamic(() => import("@/components/ui/WaitlistModal"), { ssr: false });
import { SiteButton } from "./primitives";
import { useWaitlistContext } from "./SiteShell";
import { useSiteLocale, useSiteTheme } from "./tokens";

export const NAV_LINKS = [
  { key: "common.nav.personal", href: "/features" },
  { key: "common.nav.business", href: "/business" },
  { key: "common.nav.security", href: "/security" },
  { key: "common.nav.partners", href: "/partners" },
  { key: "common.nav.fees", href: "/fees" },
  { key: "common.nav.company", href: "/about" },
  { key: "common.nav.help", href: "/faq" },
] as const;

export default function SiteNav() {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { forward, isAr } = useSiteLocale();
  const pathname = usePathname() ?? "/";
  const menu = useDisclosure();
  const ctx = useWaitlistContext();
  const local = useDisclosure();
  const openWaitlist = ctx?.open ?? local.onOpen;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => { menu.onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const home = isAr ? "/ar" : "/";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <Box
        as="a"
        href="#main"
        position="absolute"
        top="-100px"
        // Inline style, not sx: Chakra turns sx insets into physical left/right.
        style={{ insetInlineStart: "16px" }}
        zIndex={300}
        bg={t.fg}
        color={t.bg}
        px="14px"
        py="8px"
        borderRadius="999px"
        _focus={{ top: "12px" }}
      >
        {tr("common.nav.skip")}
      </Box>
      <Box
        as="nav"
        aria-label={tr("common.nav.label")}
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={200}
        transition="background-color .25s ease, border-color .25s ease"
        bg={scrolled ? (t.dark ? "rgba(22,24,28,0.78)" : "rgba(246,247,250,0.82)") : "transparent"}
        borderBottom="1px solid"
        borderColor={scrolled ? t.border : "transparent"}
        sx={scrolled ? { backdropFilter: "saturate(1.6) blur(18px)", WebkitBackdropFilter: "saturate(1.6) blur(18px)" } : undefined}
      >
        <Box
          maxW="1320px"
          mx="auto"
          px="clamp(16px, 4vw, 40px)"
          h="64px"
          display="grid"
          gridTemplateColumns={{ base: "auto 1fr", xl: "1fr auto 1fr" }}
          alignItems="center"
          gap="clamp(12px, 2vw, 28px)"
        >
          <Box as={NextLink} href={home} aria-label="tazdan" display="flex" alignItems="center" flexShrink={0}>
            <TextLogo h={26} />
          </Box>

          <Box as="ul" listStyleType="none" display={{ base: "none", xl: "flex" }} alignItems="center" justifyContent="center" gap="2px">
            {NAV_LINKS.map((l) => (
              <Box as="li" key={l.href}>
                <Box
                  as={NextLink}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  display="inline-flex"
                  alignItems="center"
                  h="36px"
                  px="12px"
                  borderRadius="999px"
                  fontSize="14.5px"
                  fontWeight={500}
                  color={isActive(l.href) ? t.fg : t.fgMuted}
                  bg={isActive(l.href) ? t.bgRaised : "transparent"}
                  transition="color .15s ease, background-color .15s ease"
                  _hover={{ color: t.fg }}
                  _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
                >
                  {tr(l.key)}
                </Box>
              </Box>
            ))}
          </Box>

          <Box display="flex" alignItems="center" gap="8px" sx={{ marginInlineStart: "auto" }}>
            <LanguageSwitcher />
            <Box display="block">
              <ColorModeToggle size={36} />
            </Box>
            <Box display={{ base: "none", md: "block" }}>
              <SiteButton onClick={openWaitlist} h="38px" px="16px" fontSize="14px">
                {tr("common.nav.join")}
              </SiteButton>
            </Box>
            <Box
              as="button"
              type="button"
              display={{ base: "inline-flex", xl: "none" }}
              alignItems="center"
              justifyContent="center"
              w="38px"
              h="38px"
              borderRadius="999px"
              border="1px solid"
              borderColor={t.border}
              color={t.fg}
              aria-label={tr("common.nav.menu")}
              aria-expanded={menu.isOpen}
              onClick={menu.onOpen}
            >
              <FiMenu size={18} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Drawer isOpen={menu.isOpen} onClose={menu.onClose} placement="top" size="full">
        <DrawerOverlay bg="rgba(0,0,0,0.4)" />
        <DrawerContent bg={t.bg} color={t.fg}>
          <Box px="16px" h="64px" display="flex" alignItems="center" justifyContent="space-between">
            <TextLogo h={24} />
            <Box
              as="button"
              type="button"
              w="38px"
              h="38px"
              borderRadius="999px"
              border="1px solid"
              borderColor={t.border}
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              aria-label={tr("common.nav.close")}
              onClick={menu.onClose}
            >
              <FiX size={18} />
            </Box>
          </Box>
          <Box px="16px" pt="8px" pb="32px" overflowY="auto">
            <Box bg={t.bgElev} border="1px solid" borderColor={t.border} borderRadius="22px" overflow="hidden">
              {[{ key: "common.nav.home", href: home }, ...NAV_LINKS].map((l, i) => (
                <Box
                  key={l.href}
                  as={NextLink}
                  href={l.href}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  h="56px"
                  px="18px"
                  borderTop={i ? "1px solid" : "none"}
                  borderColor={t.border}
                  fontSize="17px"
                  fontWeight={500}
                  color={isActive(l.href) ? t.accentText : t.fg}
                >
                  {tr(l.key)}
                  <Box as="span" color={t.fgFaint} aria-hidden>{forward}</Box>
                </Box>
              ))}
            </Box>
            <Box mt="20px" display="flex" alignItems="center" gap="10px">
              <SiteButton size="lg" flex="1" onClick={() => { menu.onClose(); openWaitlist(); }}>
                {tr("common.nav.join")}
              </SiteButton>
              <ColorModeToggle size={52} />
            </Box>
          </Box>
        </DrawerContent>
      </Drawer>

      {!ctx && <WaitlistModal isOpen={local.isOpen} onClose={local.onClose} />}
    </>
  );
}
