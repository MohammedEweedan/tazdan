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
import { FiMenu, FiChevronRight } from "react-icons/fi";
import Logo from "@/components/ui/Logo";
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
    { labelKey: "nav_features", href: "/#features" },
    { labelKey: "nav_fees",    href: "/fees" },
    { labelKey: "nav_about",   href: "/about" },
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
        >
          {/* Brand */}
          <Box as={NextLink} href="/" flexShrink={0} display="flex" alignItems="center" px={{ base: 0, md: 2 }}>
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

          {/* Right cluster */}
          <HStack spacing={{ base: 1, md: 2 }} ms="auto">
            {/* Theme + locale — now visible on mobile too (was hidden under
                the hamburger). Locale collapses to a compact flag+code chip and
                its picker opens as a bottom sheet on small screens. */}
            <HStack spacing={{ base: 0.5, md: 2 }} alignItems="center">
              <LanguageSwitcher />
              <ColorModeToggle />
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
            {/* Mobile hamburger */}
            <IconButton
              display={{ base: "flex", lg: "none" }}
              aria-label="Open menu"
              icon={<Icon as={FiMenu} boxSize={5} />}
              onClick={onOpen}
              variant="ghost"
              color={textMain}
              _hover={{ bg: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
            />
          </HStack>
        </Flex>
      </Box>

      <WaitlistModal isOpen={isWaitlistOpen} onClose={onWaitlistClose} />

      {/* Mobile drawer */}
      <Drawer placement="right" onClose={onClose} isOpen={isOpen} size="xs">
        <DrawerOverlay bg="rgba(0,0,0,0.5)" backdropFilter="blur(6px)" />
        <DrawerContent
          bg={dark ? "#11141A" : "#ffffff"}
          color={textMain}
          borderLeft="1px solid"
          borderColor={dark ? "rgba(255,255,255,0.10)" : "rgba(10,15,30,0.08)"}
        >
          <DrawerCloseButton top={4} right={4} color={textMain} />
          <DrawerBody p={0}>
            <Flex direction="column" h="100%" pt={6}>
              <Box px={6} pb={4}>
                <Logo h={34} />
              </Box>
              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />

              <VStack align="stretch" spacing={0} py={2}>
                {NAV_LINKS.map((l) => {
                  const active = isActive(l.href);
                  return (
                    <Flex
                      key={l.href}
                      as={NextLink}
                      href={l.href}
                      onClick={onClose}
                      px={6} py={4}
                      align="center"
                      justify="space-between"
                      bg={active ? (dark ? "rgba(255,255,255,0.07)" : "rgba(10,15,30,0.05)") : "transparent"}
                      _hover={{ bg: dark ? "rgba(255,255,255,0.045)" : "rgba(10,15,30,0.035)" }}
                      borderLeft="2px solid"
                      borderColor={active ? ctaBg : "transparent"}
                      transition="background 0.15s ease"
                    >
                      <Text fontSize="16px" fontWeight="750" color={textMain}>{t(l.labelKey)}</Text>
                      <Icon as={FiChevronRight} color={textSub} />
                    </Flex>
                  );
                })}
              </VStack>

              <Box flex={1} />

              {/* Theme + locale live in the top bar now (visible on mobile),
                  so the drawer doesn't duplicate them. */}
              <Divider borderColor={dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />

              <Box px={6} pt={4} pb={8}>
                <Button
                  onClick={() => { onClose(); onWaitlistOpen(); }}
                  w="100%"
                  h="46px"
                  bg={ctaBg}
                  color={ctaFg}
                  borderRadius="full"
                  fontWeight="800"
                  fontSize="15px"
                  boxShadow="0 14px 30px rgba(99,161,219,0.26)"
                  _hover={{ opacity: 0.92 }}
                >
                  {t("nav_join_waitlist")}
                </Button>
              </Box>
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
