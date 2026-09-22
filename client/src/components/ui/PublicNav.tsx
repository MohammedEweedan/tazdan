"use client";

import { useState, useEffect } from "react";
import { useTranslate } from "@tolgee/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Flex,
  HStack,
  VStack,
  Button,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerCloseButton,
  Divider,
  Icon,
  Text,
  useColorMode,
  useDisclosure,
} from "@chakra-ui/react";
import { FiMenu, FiX } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import Logo, { IconLogo } from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import WaitlistModal from "@/components/ui/WaitlistModal";

export default function PublicNav() {
  const { t } = useTranslate();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const pathname = usePathname();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isWaitlistOpen, onOpen: onWaitlistOpen, onClose: onWaitlistClose } = useDisclosure();
  const [scrolled, setScrolled] = useState(false);
  const [navTop, setNavTop] = useState(0);

  useEffect(() => {
    const banner = document.getElementById('risk-banner');
    const update = () => {
      const bannerH = banner ? banner.offsetHeight : 0;
      const scrolled12 = window.scrollY > 12;
      setScrolled(scrolled12);
      // Slide the nav up as the banner scrolls out, stop at 0
      const offset = banner ? Math.max(0, bannerH - window.scrollY) : 0;
      setNavTop(offset);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const navBg = dark
    ? scrolled ? "rgba(13,15,20,0.82)" : "rgba(13,15,20,0.46)"
    : scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.66)";
  const navBorder = scrolled
    ? dark ? "rgba(255,255,255,0.11)" : "rgba(10,15,30,0.10)"
    : dark ? "rgba(255,255,255,0.07)" : "rgba(10,15,30,0.055)";
  const textMain = dark ? "#ffffff" : "#0a0f1e";
  const textSub  = dark ? "rgba(255,255,255,0.6)" : "#475569";
  const ctaBg    =  "#63a1db";
  const ctaFg    = "white";

  const NAV_LINKS = [
    { labelKey: "nav_features", href: "/features" },
    { labelKey: "nav_fees",    href: "/fees" },
    { labelKey: "nav_about",   href: "/about" },
    { labelKey: "nav_contact",  href: "/contact" },
    { labelKey: "nav_trust",    href: "/trust" },
    { labelKey: "nav_help",     href: "/help" },
    { labelKey: "nav_careers",  href: "/careers" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <>
      <Box
        as="nav"
        position="fixed"
        top={`${navTop}px`} left={0} right={0}
        zIndex={200}
        px={{ base: 3, md: 6 }}
        pt={{ base: 2, md: 3 }}
        pb={{ base: 2, md: 0 }}
        transition="all 0.25s ease"
        display="flex"
        alignItems="flex-start"
        justifyContent="center"
        pointerEvents="none"
      >
        <Flex
          w="100%"
          maxW="1120px"
          mx="auto"
          align="center"
          gap={{ base: 2, md: 3 }}
          bg={navBg}
          border="1px solid"
          borderColor={navBorder}
          borderRadius={{ base: "14px", md: "999px" }}
          backdropFilter="blur(22px) saturate(180%)"
          boxShadow={scrolled ? (dark ? "0 18px 50px rgba(0,0,0,0.26)" : "0 18px 46px rgba(10,15,30,0.07)") : "none"}
          transition="all 0.25s ease"
          px={{ base: 3, md: 2.5 }}
          py={{ base: 2, md: 1.5 }}
          h={{ base: "52px", md: "56px" }}
          pointerEvents="auto"
          position="relative"
        >
          {/* Desktop brand. Mobile gets its own equal-width grid cell below. */}
          <Box
            as={NextLink}
            href="/"
            flexShrink={0}
            display={{ base: "none", lg: "flex" }}
            alignItems="center"
            px={2}
          >
            <Logo h={40} />
          </Box>

          {/* Desktop links */}
          <HStack display={{ base: "none", lg: "flex" }} spacing={0.5} mx={2}>
            {NAV_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Box
                  key={l.href}
                  as={NextLink}
                  href={l.href}
                  px={3.5} py={1.5}
                  borderRadius="full"
                  fontSize="13px"
                  fontWeight="700"
                  color={active ? textMain : textSub}
                  bg={active ? (dark ? "rgba(255,255,255,0.08)" : "rgba(10,15,30,0.055)") : "transparent"}
                  _hover={{ color: textMain, bg: dark ? "rgba(255,255,255,0.055)" : "rgba(10,15,30,0.045)" }}
                  transition="all 0.15s ease"
                >
                  {t(l.labelKey)}
                </Box>
              );
            })}
          </HStack>

          {/* Mobile and tablet: four equal cells keep the brand, locale,
              theme and menu controls centred at 12.5 / 37.5 / 62.5 / 87.5%.
              Using one grid also behaves identically in LTR and RTL. */}
          <Box
            display={{ base: "grid", lg: "none" }}
            position="absolute"
            inset={0}
            gridTemplateColumns="repeat(4, minmax(0, 1fr))"
            alignItems="center"
          >
            <Flex align="center" justify="center" minW={0}>
              <Box as={NextLink} href="/" display="inline-flex" aria-label="Tazdan home">
                <IconLogo size={36} />
              </Box>
            </Flex>
            <Flex align="center" justify="center" minW={0}>
              <LanguageSwitcher />
            </Flex>
            <Flex align="center" justify="center" minW={0}>
              <ColorModeToggle size={36} />
            </Flex>
            <Flex align="center" justify="center" minW={0}>
              <IconButton
                aria-label="Open menu"
                icon={<Icon as={FiMenu} boxSize={5} />}
                onClick={onOpen}
                variant="ghost"
                color={textMain}
                _hover={{ bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
              />
            </Flex>
          </Box>

          {/* Right cluster (desktop) */}
          <HStack spacing={{ base: 1, md: 2 }} ms="auto" display={{ base: "none", lg: "flex" }}>
            {/* Theme + locale — now visible on mobile too (was hidden under
                the hamburger). Locale collapses to a compact flag+code chip and
                its picker opens as a bottom sheet on small screens. */}
            <HStack spacing={{ base: 0.5, md: 2 }} alignItems="center">
              <LanguageSwitcher />
              <ColorModeToggle size={36} />
            </HStack>
            {/* Join Waitlist CTA — hide the label on the smallest screens to
                keep the bar from crowding once theme+locale are present. */}
            <Button
              onClick={onWaitlistOpen}
              size="sm"
              bg={ctaBg}
              color="white"
              borderRadius="full"
              fontWeight="700"
              fontSize="13px"
              px={{ base: 3.5, md: 5 }}
              h={{ base: "34px", md: "36px" }}
              boxShadow="0 10px 24px rgba(99,161,219,0.24)"
              _hover={{ opacity: 0.92, transform: "translateY(-1px)", boxShadow: "0 14px 30px rgba(99,161,219,0.30)" }}
              transition="all 0.15s ease"
              flexShrink={0}
              display={{ base: "none", sm: "inline-flex" }}
            >
              {t("nav_join_waitlist")}
            </Button>
          </HStack>
        </Flex>
      </Box>

      <WaitlistModal isOpen={isWaitlistOpen} onClose={onWaitlistClose} />

      {/* ── FULL-SCREEN MENU ──────────────────────────────────────────────
          Replaces the side drawer. A drawer is a panel that slides over the
          page; this takes the whole viewport and the links arrive on a
          stagger with their own parallax offset, so opening the menu reads as
          a deliberate change of place rather than a tray sliding out.
          AnimatePresence keeps the exit animation instead of an instant cut. */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="fullscreen-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", inset: 0, zIndex: 1400,
              background: dark ? "rgba(10,12,16,0.92)" : "rgba(255,255,255,0.94)",
              backdropFilter: "blur(26px) saturate(170%)",
              WebkitBackdropFilter: "blur(26px) saturate(170%)",
            }}
          >
            <Flex direction="column" h="100%" px={7} pt={6} pb={10}>
              <Flex align="center" justify="space-between" mb={10}>
                <Logo h={34} />
                <IconButton
                  aria-label="Close menu"
                  icon={<Icon as={FiX} boxSize={5} />}
                  onClick={onClose}
                  variant="ghost"
                  color={textMain}
                  borderRadius="full"
                  _hover={{ bg: dark ? "rgba(255,255,255,0.08)" : "rgba(10,15,30,0.06)" }}
                />
              </Flex>

              <VStack align="stretch" spacing={1} flex={1}>
                {NAV_LINKS.map((l, i) => {
                  const active = isActive(l.href);
                  return (
                    <motion.div
                      key={l.href}
                      initial={{ opacity: 0, y: 26 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      /* Each row trails the one above it — the parallax. */
                      transition={{ duration: 0.5, delay: 0.05 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Flex
                        as={NextLink}
                        href={l.href}
                        onClick={onClose}
                        align="baseline"
                        gap={3}
                        py={2.5}
                        _hover={{ opacity: 0.65 }}
                        transition="opacity .18s ease"
                      >
                        <Text
                          fontSize="11px" fontWeight="700" color={textSub}
                          minW="22px"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </Text>
                        <Text
                          fontFamily="'DM Sans', sans-serif"
                          fontSize={{ base: "32px", sm: "38px" }}
                          fontWeight="800" letterSpacing="-0.04em" lineHeight={1.15}
                          color={active ? ctaBg : textMain}
                        >
                          {t(l.labelKey)}
                        </Text>
                      </Flex>
                    </motion.div>
                  );
                })}
              </VStack>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 + NAV_LINKS.length * 0.045, ease: [0.22, 1, 0.36, 1] }}
              >
                <Button
                  onClick={() => { onClose(); onWaitlistOpen(); }}
                  w="100%" h="52px" bg={ctaBg} color="white"
                  borderRadius="full" fontWeight="700" fontSize="15px"
                  _hover={{ opacity: 0.92 }}
                >
                  {t("nav_join_waitlist")}
                </Button>
              </motion.div>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
